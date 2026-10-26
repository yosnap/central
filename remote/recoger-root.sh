#!/bin/bash
# infobar: la parte que necesita root (docker y fail2ban). Se instala en
# /usr/local/lib/infobar/recoger-root (root:root 0755) y sudoers solo permite ESTE programa, sin
# argumentos, al usuario infobar. Solo lee.
export LC_ALL=C PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# como root, nada del hogar de infobar (plugins de ~/.docker, etc.)
export HOME=/root DOCKER_CONFIG=/root/.docker
# Presupuesto de tiempo: ningun comando arranca pasados LIMITE s y cada uno dura 3 s como mucho, asi que el programa acaba en LIMITE + 3 s,
# antes del tiempo que le da recoger.sh. Lo que se salta o se pasa de tiempo se apunta en MARCAS (un fichero: `t` casi siempre corre dentro
# de $(...) y una variable no volveria) y al final se declara en "### fin_root": con omitidos > 0 el Mac descarta TODAS las secciones de
# root («sin dato»), nunca las toma por ceros.
INICIO=$(date +%s); LIMITE=7
MARCAS=$(mktemp) || exit 0
trap 'rm -f "$MARCAS"' EXIT
t() {
  if [ $(( $(date +%s) - INICIO )) -ge $LIMITE ]; then echo . >>"$MARCAS"; return 1; fi
  timeout 3 "$@" </dev/null 2>/dev/null
  local rc=$?
  [ $rc = 124 ] && echo . >>"$MARCAS"
  return $rc
}

echo "### version_root"
echo 4                                             # 3 = 2 + servicios_detalle (imagen y dominios); 4 = + arranque y versión de cada servicio

echo "### servicios"
# Dokploy y Easypanel despliegan servicios de Swarm; si el nodo no es manager, contenedores sueltos
if [ "$(t docker info --format '{{.Swarm.ControlAvailable}}')" = "true" ]; then
  t docker service ls --format '{{.Name}}\t{{.Replicas}}' | head -n 300
fi

echo "### contenedores"
t docker ps -a --format '{{.Names}}\t{{.State}}\t{{.Status}}' | head -n 100

echo "### bastionado_root"
# configuracion EFECTIVA de sshd (sshd -T necesita root) y cortafuegos
t sshd -T | awk '$1 ~ /^(passwordauthentication|permitrootlogin|permitemptypasswords|kbdinteractiveauthentication|maxauthtries|x11forwarding)$/ {print "sshd_" $1, $2}'
if command -v ufw >/dev/null 2>&1; then
  echo "ufw $(t ufw status | awk 'NR==1{print $2}')"
fi
# politica por defecto de entrada: DROP = se filtra (ufw la pone asi); las reglas de docker no cuentan
echo "input_politica $(t iptables -S INPUT | awk '$1=="-P"{print $3; exit}')"
echo "fail2ban_activo $(t systemctl is-active fail2ban)"
# reglas de sudo SIN contrasena para usuarios normales. No cuentan: la de infobar (un solo programa)
# ni las de root (root ya lo puede todo: cloud-init pone "root ALL=(ALL) NOPASSWD:ALL" y es inocua)
NOPW="$(grep -rHsE '^[^#]*NOPASSWD' /etc/sudoers /etc/sudoers.d/ --exclude=infobar | grep -vE ':[[:space:]]*root[[:space:]]')"
echo "sudo_nopasswd $(printf '%s' "$NOPW" | grep -c .)"
echo "sudo_nopasswd_ficheros $(printf '%s' "$NOPW" | cut -d: -f1 | xargs -r -n1 basename | sort -u | tr '\n' ',' | tr -cd 'A-Za-z0-9._,-')"

echo "### fail2ban"
if command -v fail2ban-client >/dev/null 2>&1; then
  t fail2ban-client status sshd | awk -F: '/Currently banned/{gsub(/[ \t]/,"",$2); print "ahora", $2}
                                         /Total banned/{gsub(/[ \t]/,"",$2); print "total", $2}'
else
  echo "no-instalado"
fi

echo "### inventario"
# Contenedores con estado, salud y reinicios. UNA llamada a `docker inspect` con una plantilla FIJA que solo nombra los campos de abajo (nunca
# Config.Env, Cmd, Mounts, Image ni `.State.Health` entero: su .Log lleva la salida del healthcheck). Cada texto sale con {{json}}, asi un
# valor con saltos de linea, tabuladores o "### algo" no puede romper lineas ni abrir secciones. Los mas antiguos primero (produccion antes
# que los efimeros) y como mucho 200: lo que sobra se declara en "truncado" y el Mac no concluye que lo que no ve haya desaparecido.
# Marco "n <lineas>" ... "fin <lineas> <codigo>" como en intentos; "pedidos" = ids que se inspeccionan, el Mac exige tantas lineas "c".
# PRESUPUESTO PROPIO: solo arranca si no se han gastado ya 5 s y no usa `t`, asi que si el inventario no llega a tiempo se pierde el inventario
# («fuente error»), no las secciones de seguridad de root ni el cierre de fin_root.
PLANTILLA='c{{"\t"}}{{json .Name}}{{"\t"}}{{json .State.Status}}{{"\t"}}{{if .State.Health}}{{json .State.Health.Status}}{{else}}"none"{{end}}{{"\t"}}{{.RestartCount}}{{"\t"}}{{.State.ExitCode}}{{"\t"}}{{json .State.StartedAt}}{{"\t"}}{{json .HostConfig.RestartPolicy.Name}}{{"\t"}}{{json (index .Config.Labels "com.docker.compose.project")}}{{"\t"}}{{json (index .Config.Labels "com.docker.compose.service")}}{{"\t"}}{{json (index .Config.Labels "com.docker.swarm.service.name")}}{{"\t"}}{{json (index .Config.Labels "com.docker.swarm.task.id")}}'
cuerpo=$(
  echo "ahora $(date +%s)"
  if ! command -v docker >/dev/null 2>&1; then
    echo "fuente ninguna"
  elif [ $(( $(date +%s) - INICIO )) -ge 5 ]; then
    echo "fuente error"
  elif ids=$(timeout 2 docker ps -aq --no-trunc </dev/null 2>/dev/null); then
    total=$(printf '%s\n' "$ids" | grep -c .)
    pedidos=$(printf '%s\n' "$ids" | grep . | tac | head -n 200 | tr '\n' ' ')
    n=$(printf '%s\n' $pedidos | grep -c .)
    echo "fuente docker"; echo "total $total"; echo "pedidos $n"; echo "truncado $([ "$total" -gt "$n" ] && echo si || echo no)"
    # shellcheck disable=SC2086
    [ "$n" -gt 0 ] && timeout 3 docker inspect --format "$PLANTILLA" $pedidos </dev/null 2>/dev/null | cut -b -1200
  else
    echo "fuente error"
  fi
)
cuerpo=$(printf '%s\n' "$cuerpo" | head -n 230)
nlin=$(printf '%s\n' "$cuerpo" | grep -c '')
echo "n $nlin"; printf '%s\n' "$cuerpo"; echo "fin $nlin 0"

echo "### webs"
# Dominios que sirve el proxy (Traefik de Dokploy, EasyPanel y Coolify): SOLO los nombres dentro de Host(`...`) salen de aqui. Se leen las etiquetas de los servicios de Swarm y de los
# contenedores y los ficheros dinamicos del proxy (pueden llevar hashes de autenticacion basica: jamas se copian). La tuberia entera (docker, find, grep) corre bajo UN solo `timeout`
# de 3 s y solo arranca si no se han gastado ya 6 s: no puede quitarle el tiempo a las demas secciones de root. Todo pasa por dos `grep -o` (primero la gramatica completa de
# Host(`a`, `b`), luego los literales entre comillas inversas) y un filtro final con la forma de un nombre DNS en minusculas: ningun otro byte llega a la salida. Si se agota el
# tiempo, «fuente error» (sin dato, nunca «cero webs»). Solo se leen ficheros normales (`-type f`, sin enlaces simbolicos ni subdirectorios) de menos de 2 MB. Maximo 200.
DIRS_PROXY="/etc/dokploy/traefik/dynamic /etc/easypanel/traefik/config /data/coolify/proxy/dynamic"
export DIRS_PROXY
read -r -d '' EXTRAER <<'EOS' || true
{
  if command -v docker >/dev/null 2>&1; then
    docker service inspect --format '{{json .Spec.Labels}}' $(docker service ls -q </dev/null 2>/dev/null) </dev/null 2>/dev/null
    docker inspect --format '{{json .Config.Labels}}' $(docker ps -aq </dev/null 2>/dev/null) </dev/null 2>/dev/null
  fi
  for d in $DIRS_PROXY; do
    [ -d "$d" ] && find "$d" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.toml' \) -size -2M -exec sh -c 'for f; do head -c 1048576 "$f"; echo; done' sh {} + 2>/dev/null
  done
} | head -c 4194304 | grep -ohE 'Host(SNI)?\(([[:space:]]*`[^`]*`[[:space:]]*,?)+\)' | grep -oE '`[^`]{1,253}`' | tr -d '`' | tr 'A-Z' 'a-z' \
  | grep -E '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' | sort -u
EOS
cuerpo=$(
  if [ $(( $(date +%s) - INICIO )) -ge 6 ]; then
    echo "fuente error"
  else
    todos=$(timeout 3 sh -c "$EXTRAER" </dev/null 2>/dev/null); rc=$?
    if [ "$rc" = 124 ]; then
      echo "fuente error"
    else
      echo "fuente ok"
      total=$(printf '%s\n' "$todos" | grep -c .)
      echo "total $total"
      echo "truncado $([ "$total" -gt 200 ] && echo si || echo no)"
      printf '%s\n' "$todos" | grep . | head -n 200 | sed 's/^/web /'
    fi
  fi
)
cuerpo=$(printf '%s\n' "$cuerpo" | head -n 210)
nlin=$(printf '%s\n' "$cuerpo" | grep -c '')
echo "n $nlin"; printf '%s\n' "$cuerpo"; echo "fin $nlin 0"

echo "### servicios_detalle"
# Imagen y dominios de CADA servicio de Swarm o contenedor, para que el Mac sepa qué es cada uno (aplicación, base de datos...) y qué web
# sirve. Los dominios salen de las reglas Host(`...`) de las etiquetas de Traefik y de los ficheros dinámicos del proxy (Easypanel, Dokploy,
# Coolify), emparejando cada router con el servicio al que apunta (url http://<servicio>:puerto). Lo interpreta python3 -I (sin módulos del
# usuario) leyendo solo lo mismo que la sección webs; a la salida solo llegan nombres con la forma de un servicio, imágenes y nombres DNS
# validados: nunca etiquetas, variables ni el resto de los ficheros. PRESUPUESTO PROPIO: solo arranca si no se han gastado 6 s y dura 2 s
# como mucho, así no puede dejar sin cierre las secciones de root. Sin python3 o sin tiempo, «fuente ninguna/error» (sin dato).
read -r -d '' DETALLE_PY <<'EOS' || true
import json, os, re, sys
HOST = re.compile(r'Host(?:SNI)?\(([^)]*)\)')
LIT = re.compile(r'`([^`]{1,253})`')
DNS = re.compile(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')
IMAGE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._/:-]{0,199}$')
URL = re.compile(r'https?://([A-Za-z0-9][A-Za-z0-9_.-]{0,127})[:/]')
VERSION = re.compile(r'^v?\d+\.\d+(\.\d+)?([-+][A-Za-z0-9.]+)?$')
STAMP = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d')
doms, imgs, since, vers = {}, {}, {}, {}
def hosts(rule):
    return {h.lower() for m in HOST.finditer(rule or '') for h in LIT.findall(m.group(1)) if DNS.match(h.lower())}
def add(name, hs):
    if name and NAME.match(name) and hs:
        doms.setdefault(name, set()).update(hs)
def js(x):
    try: return json.loads(x)
    except Exception: return None
for line in sys.stdin.read().split('\n'):
    p = line.split('\t')
    if len(p) != 4: continue
    name, labels, image, stamp = js(p[0]), js(p[1]), js(p[2]), js(p[3])
    if not isinstance(name, str): continue
    name = name.lstrip('/')
    # la tarea de un servicio de Swarm aporta la versión de su imagen al servicio
    owner = labels.get('com.docker.swarm.service.name') if isinstance(labels, dict) else None
    target = owner if isinstance(owner, str) and NAME.match(owner) else name
    if isinstance(labels, dict):
        v = labels.get('org.opencontainers.image.version')
        if isinstance(v, str) and VERSION.match(v.strip()): vers[target] = v.strip()
    if owner: continue  # el resto (imagen, dominios, arranque) es del servicio, no de cada tarea
    if isinstance(stamp, str) and STAMP.match(stamp) and not stamp.startswith('0001'): since[name] = stamp[:19] + 'Z'
    if isinstance(image, str):
        image = image.split('@')[0]
        if NAME.match(name) and IMAGE.match(image): imgs[name] = image
    if isinstance(labels, dict):
        add(name, set().union(*[hosts(v) for k, v in labels.items() if isinstance(v, str) and k.startswith('traefik.http.routers.') and k.endswith('.rule')] or [set()]))
def from_conf(conf):
    http = conf.get('http') if isinstance(conf, dict) else None
    if not isinstance(http, dict): return
    routers, services = http.get('routers') or {}, http.get('services') or {}
    for r in routers.values():
        if not isinstance(r, dict): continue
        svc = services.get(r.get('service')) if isinstance(services, dict) else None
        for srv in ((svc or {}).get('loadBalancer') or {}).get('servers') or []:
            m = URL.match(str((srv or {}).get('url', '')) + '/')
            if m: add(m.group(1), hosts(r.get('rule')))
def from_yaml(text):
    # YAML sencillo de los ficheros dinámicos de Traefik: router -> (rule, service) y service -> url
    section, router, service, rules, targets, urls = None, None, None, {}, {}, {}
    for raw in text.split('\n'):
        line = raw.split('#')[0].rstrip()
        if not line.strip(): continue
        ind, body = len(line) - len(line.lstrip()), line.strip()
        key = re.match(r'^-?\s*([A-Za-z0-9_.@-]+):\s*(.*)$', body)
        if not key: continue
        k, v = key.group(1), key.group(2).strip().strip('"\'')
        if k in ('routers', 'services') and not v: section, sect_ind = k, ind; continue
        if section and ind <= sect_ind: section = None
        if section == 'routers':
            if ind == sect_ind + 2 and not v: router = k
            elif router and k == 'rule': rules[router] = hosts(v)
            elif router and k == 'service': targets[router] = v
        elif section == 'services':
            if ind == sect_ind + 2 and not v: service = k
            elif service and k == 'url':
                m = URL.match(v + '/')
                if m: urls.setdefault(service, []).append(m.group(1))
    for r, svc in targets.items():
        for name in urls.get(svc, []): add(name, rules.get(r, set()))
for d in os.environ.get('DIRS_PROXY', '').split():
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d))[:500]:
        path = os.path.join(d, f)
        if not f.endswith(('.yml', '.yaml', '.toml', '.json')) or os.path.islink(path) or not os.path.isfile(path) or os.path.getsize(path) > 2_000_000: continue
        with open(path, errors='replace') as fh: text = fh.read(1_048_576)
        conf = js(text)
        if conf is not None: from_conf(conf)
        else: from_yaml(text)
print('fuente ok')
n = 0
for name in sorted(set(imgs) | set(doms)):
    if n >= 200: break
    if name in imgs: print('i', name, imgs[name])
    if name in since: print('s', name, since[name])
    if name in vers: print('v', name, vers[name])
    for h in sorted(doms.get(name, ()))[:20]: print('d', name, h)
    n += 1
EOS
read -r -d '' DETALLE_DOCKER <<'EOS' || true
docker service inspect --format '{{json .Spec.Name}}{{"\t"}}{{json .Spec.Labels}}{{"\t"}}{{json .Spec.TaskTemplate.ContainerSpec.Image}}{{"\t"}}{{json .UpdatedAt}}' $(docker service ls -q </dev/null 2>/dev/null) </dev/null 2>/dev/null
docker inspect --format '{{json .Name}}{{"\t"}}{{json .Config.Labels}}{{"\t"}}{{json .Config.Image}}{{"\t"}}{{json .State.StartedAt}}' $(docker ps -aq </dev/null 2>/dev/null) </dev/null 2>/dev/null
EOS
cuerpo=$(
  if ! command -v docker >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
    echo "fuente ninguna"
  elif [ $(( $(date +%s) - INICIO )) -ge 6 ]; then
    echo "fuente error"
  else
    salida=$(timeout 2 sh -c "$DETALLE_DOCKER" | head -c 2097152 | timeout 2 python3 -I -c "$DETALLE_PY" 2>/dev/null); rc=$?
    if [ "$rc" = 0 ] && [ -n "$salida" ]; then printf '%s\n' "$salida"; else echo "fuente error"; fi
  fi
)
cuerpo=$(printf '%s\n' "$cuerpo" | head -n 1200)
nlin=$(printf '%s\n' "$cuerpo" | grep -c '')
echo "n $nlin"; printf '%s\n' "$cuerpo"; echo "fin $nlin 0"

echo "### fin_root"
echo "omitidos $(grep -c . "$MARCAS")"
