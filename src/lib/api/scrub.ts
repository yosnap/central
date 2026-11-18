/**
 * Limpieza de lo que sale por la API v1 hacia otras apps: sin IPs literales ni rutas de clave o de usuario.
 * - Una URL o un valor cuyo host es una IP se quita entero (null; en listas, desaparece).
 * - En un texto libre (errores, detalles de comprobaciones, alertas) la IP y la ruta se sustituyen por un marcador.
 * Las versiones («1.2.3.4») no se tocan: sus campos se saltan por nombre.
 */
const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1?\d?\d)`
const IPV4 = String.raw`${OCTET}(?:\.${OCTET}){3}`
/** La forma con guiones de sslip.io o nip.io: `1-2-3-4.sslip.io`. */
const IPV4_DASHED = String.raw`${OCTET}(?:-${OCTET}){3}(?=\.)`
const IPV6 = String.raw`(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{0,4}::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?)`
/**
 * IP dentro de un texto, también metida en un nombre de host (`web.1.2.3.4.sslip.io`), pero no dentro de una serie
 * más larga de números con puntos (`1.2.3.4.5`).
 */
const IP_IN_TEXT = new RegExp(String.raw`(?<!\d\.|\d)(?:${IPV4}(?!\.?\d)|${IPV4_DASHED}|(?<![\w])${IPV6}(?![\w.]))`, 'gi')
const IP_TEST = new RegExp(IP_IN_TEXT.source, 'i')
/** Solo una IP, con o sin puerto (una IPv6 sin corchetes no es una URL válida). */
const BARE_IP = new RegExp(String.raw`^\[?(?:${IPV4}|${IPV6})\]?(?::\d+)?$`, 'i')
/** Rutas de usuario o de claves: `~/…`, `/Users/…`, `/home/…`, `/root/…`, cualquier `.ssh/…` y ficheros de clave. */
const SENSITIVE_PATH = /(?:~|\/Users|\/home|\/root)\/[^\s,;)"']*|[^\s,;)"']*\.ssh\/[^\s,;)"']*|\bid_(?:rsa|ed25519|ecdsa|dsa)\b[^\s,;)"']*|[^\s,;)"']+\.(?:pem|key)\b/g

const SKIP_KEYS = new Set(['version', 'localVersion', 'deployedVersion', 'liveVersion', 'branchVersions', 'framework', 'scriptVersion', 'rootVersion'])

export const IP_MARK = '[IP oculta]'
export const PATH_MARK = '[ruta oculta]'

/**
 * Valor que es una dirección (URL, host o host:puerto) cuyo host es o contiene una IP: `203.0.113.7`,
 * `http://[2001:db8::1]:8080/x`, `https://web.203.0.113.7.sslip.io`. Se quita entero: con un marcador no sirve.
 */
export function isIpValue(s: string): boolean {
  const v = s.trim()
  if (!v || /\s/.test(v)) return false
  if (BARE_IP.test(v)) return true
  let host: string
  try { host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `http://${v}`).hostname } catch { return false }
  return IP_TEST.test(host.replace(/^\[|\]$/g, ''))
}

/** Texto sin IPs ni rutas sensibles. */
export function redactText(s: string): string {
  return s.replace(SENSITIVE_PATH, PATH_MARK).replace(IP_IN_TEXT, IP_MARK)
}

type Opts = { /** Quita también rutas de usuario y de claves (servidores y alertas; no la ficha de un proyecto, cuyas carpetas son su dato). */ paths: boolean }

function scrubString(s: string, opts: Opts): string | null {
  if (isIpValue(s)) return null
  const noIp = s.replace(IP_IN_TEXT, IP_MARK)
  return opts.paths ? noIp.replace(SENSITIVE_PATH, PATH_MARK) : noIp
}

/** Tipo tras limpiar: un texto suelto puede quedar en null; en una lista de textos, el que era una IP desaparece. */
export type Scrubbed<T> = T extends string ? string | null
  : T extends Date ? T
  : T extends readonly (infer U)[] ? (U extends string ? U[] : Scrubbed<U>[])
  : T extends object ? { [K in keyof T]: Scrubbed<T[K]> }
  : T

/** Copia profunda limpia. Las fechas, los números y los objetos que no son planos pasan tal cual. */
export function scrubDeep<T>(value: T, opts: Opts = { paths: true }): Scrubbed<T> {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return scrubString(v, opts)
    if (Array.isArray(v)) return v.map(walk).filter((x, i) => !(x === null && typeof v[i] === 'string'))
    // solo objetos planos: Date, Decimal y similares pasan tal cual
    if (v && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v))) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SKIP_KEYS.has(k) ? x : walk(x)]))
    }
    return v
  }
  // el recorrido sigue exactamente la forma de Scrubbed<T>
  return walk(value) as Scrubbed<T>
}
