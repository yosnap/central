/**
 * Propuesta de tipo, plataforma y dominios de un proyecto a partir de sus ficheros.
 * Solo lee ficheros de configuración conocidos; nunca `.env` (sí `.env.example`).
 */
import fs from 'node:fs'
import path from 'node:path'

export type ProjectType = 'WEB_SITE' | 'WEB_APP' | 'ECOMMERCE' | 'API' | 'ADDON' | 'PLUGIN' | 'MOBILE_APP' | 'DESKTOP_APP' | 'BROWSER_EXTENSION' | 'LIBRARY' | 'AUTOMATION' | 'CONTENT'
export type Platform = 'WORDPRESS' | 'WOOCOMMERCE' | 'PRESTASHOP' | 'SHOPIFY' | 'N8N' | 'CHROME' | 'ELEMENTOR' | 'OTHER'

type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; keywords?: string[]; homepage?: string; bin?: unknown; n8n?: unknown }

const read = (file: string, max = 4096) => {
  try {
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(max)
    const n = fs.readSync(fd, buf, 0, max, 0)
    fs.closeSync(fd)
    return buf.subarray(0, n).toString('utf8')
  } catch {
    return ''
  }
}

const FRONTEND = ['next', 'react', 'vue', 'nuxt', 'astro', 'svelte', '@angular/core', 'vite']
const BACKEND = ['express', 'fastify', 'hono', '@nestjs/core', 'koa']
const DATABASE = ['prisma', '@prisma/client', 'drizzle-orm', 'mongoose', '@supabase/supabase-js', 'payload', 'pg', 'mysql2']

/** Cabecera de un plugin o tema de WordPress en los .php de la raíz o en style.css. */
function wordpressHeader(dir: string, entries: Set<string>): string | null {
  if (entries.has('style.css')) {
    const css = read(path.join(dir, 'style.css'), 2048)
    if (/Theme Name:/i.test(css)) return css
  }
  for (const f of entries) {
    if (!f.endsWith('.php')) continue
    const php = read(path.join(dir, f), 2048)
    if (/Plugin Name:/i.test(php)) return php
  }
  return null
}

export function detectType(dir: string, entries: Set<string>, pkg: Pkg | null): { type?: ProjectType; platform?: Platform } {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const has = (...names: string[]) => names.some((n) => n in deps)

  const wp = wordpressHeader(dir, entries)
  if (wp) {
    if (/WC (requires|tested)/i.test(wp) || /woocommerce/i.test(wp)) return { type: 'PLUGIN', platform: 'WOOCOMMERCE' }
    if (/Elementor (requires|tested)/i.test(wp) || /elementor/i.test(wp)) return { type: 'PLUGIN', platform: 'ELEMENTOR' }
    return { type: 'PLUGIN', platform: 'WORDPRESS' }
  }
  if (entries.has('config.xml') && /<module>/i.test(read(path.join(dir, 'config.xml'), 2048))) return { type: 'PLUGIN', platform: 'PRESTASHOP' }
  if (pkg?.n8n || pkg?.keywords?.includes('n8n-community-node-package')) return { type: 'PLUGIN', platform: 'N8N' }
  if (entries.has('shopify.app.toml') || entries.has('shopify.theme.toml') || has('@shopify/shopify-app-remix', '@shopify/app-bridge')) return { type: 'PLUGIN', platform: 'SHOPIFY' }
  if (entries.has('manifest.json') && /"manifest_version"/.test(read(path.join(dir, 'manifest.json')))) return { type: 'BROWSER_EXTENSION', platform: 'CHROME' }
  if (has('wxt', 'plasmo', '@crxjs/vite-plugin')) return { type: 'BROWSER_EXTENSION', platform: 'CHROME' }

  if (has('expo', 'react-native') || entries.has('pubspec.yaml') || has('@capacitor/core')) return { type: 'MOBILE_APP' }
  if (has('electron', '@tauri-apps/api') || entries.has('src-tauri')) return { type: 'DESKTOP_APP' }
  if (has('@modelcontextprotocol/sdk')) return { type: 'LIBRARY' }

  if (entries.has('wp-config.php') || entries.has('wp-content')) {
    const shop = fs.existsSync(path.join(dir, 'wp-content', 'plugins', 'woocommerce'))
    return { type: shop ? 'ECOMMERCE' : 'WEB_SITE' }
  }
  if (has('@shopify/hydrogen') || (has('stripe') && has('@medusajs/medusa'))) return { type: 'ECOMMERCE' }
  if (has('astro')) return { type: has(...DATABASE) ? 'WEB_APP' : 'WEB_SITE' }
  if (has(...FRONTEND)) return { type: 'WEB_APP' }
  if (has(...BACKEND)) return { type: 'API' }
  if (entries.has('requirements.txt') || entries.has('pyproject.toml')) {
    const py = read(path.join(dir, entries.has('requirements.txt') ? 'requirements.txt' : 'pyproject.toml'))
    if (/\b(fastapi|flask|django)\b/i.test(py)) return { type: 'API' }
  }
  if (pkg?.bin) return { type: 'LIBRARY' }
  return {}
}

// --- Dominios ---

const IGNORE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|(^|\.)(example\.(com|org|net)|test|local|invalid|localhost)$/i
// Textos de ejemplo: tu-dominio.com, xxx.upstash.io, your-app.vercel.app…
const PLACEHOLDER = /(^|[.-])(xxx+|tu|your|mi|my|ejemplo|example|dominio|domain|placeholder|changeme|project-?ref|subdomain)([.-]|$)|x{3,}/i
// Servicios de terceros: no son dominios del proyecto
const THIRD_PARTY = /(^|\.)(github\.com|githubusercontent\.com|gitlab\.com|bitbucket\.org|alchemyapi\.io|infura\.io|npmjs\.(com|org)|schema\.org|w3\.org|googleapis\.com|gstatic\.com|google\.com|upstash\.io|b-cdn\.net|bunnycdn\.com|cloudfront\.net|amazonaws\.com|r2\.dev|cloudflarestorage\.com|imagekit\.io|cloudinary\.com|posthog\.com|quaderno\.io|supabase\.co|supabase\.in|stripe\.com|sentry\.io|firebaseio\.com|firebaseapp\.com|openai\.com|anthropic\.com|resend\.com|sendgrid\.net|mailgun\.org|twilio\.com|paypal\.com|redsys\.es|mongodb\.net|neon\.tech|clerk\.(com|dev)|auth0\.com|algolia\.net|pusher\.com|segment\.io|mixpanel\.com|hotjar\.com|youtube\.com|vimeo\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com)$/i

function host(raw: string): string | null {
  try {
    const h = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase()
    if (!h.includes('.') || h.includes('${') || h.includes('<') || IGNORE_HOST.test(h) || PLACEHOLDER.test(h) || THIRD_PARTY.test(h)) return null
    return h
  } catch {
    return null
  }
}

export function detectDomains(dir: string, entries: Set<string>, pkg: Pkg | null): string[] {
  const found = new Set<string>()
  const add = (raw?: string | null) => { const h = raw ? host(raw.trim()) : null; if (h) found.add(h) }

  add(pkg?.homepage)
  for (const f of entries) {
    if (/^astro\.config\.(m?js|ts)$/.test(f)) add(read(path.join(dir, f)).match(/site:\s*['"`]([^'"`]+)['"`]/)?.[1])
  }
  if (entries.has('CNAME')) add(read(path.join(dir, 'CNAME'), 256).split('\n')[0])
  if (entries.has('vercel.json')) {
    try {
      const v = JSON.parse(read(path.join(dir, 'vercel.json'), 16384)) as { alias?: string | string[] }
      for (const a of [v.alias ?? []].flat()) add(a)
    } catch { /* vercel.json inválido */ }
  }
  for (const f of ['.env.example', '.env.sample', '.env.template']) {
    if (!entries.has(f)) continue
    // solo variables que suelen apuntar al propio sitio: SITE_URL, APP_URL, NEXT_PUBLIC_SITE_URL, NEXTAUTH_URL…
    for (const m of read(path.join(dir, f), 16384).matchAll(/^(?:[A-Z0-9]+_)*(?:SITE|APP|BASE|PUBLIC|FRONTEND|WEB|NEXTAUTH|AUTH|API|CANONICAL)_(?:URL|DOMAIN|HOST)\s*=\s*["']?(https?:\/\/[^\s"'#]+)/gm)) add(m[1])
  }
  for (const f of entries) {
    if (!/^(docker-)?compose.*\.ya?ml$/.test(f)) continue
    for (const m of read(path.join(dir, f), 32768).matchAll(/Host\(`([^`]+)`\)/g)) add(m[1])
  }
  return [...found].slice(0, 10)
}

// Monorepos: si la raíz no aclara nada, se mira en las carpetas típicas de un nivel más abajo
const SUBPROJECTS = ['apps', 'packages', 'frontend', 'backend', 'web', 'client', 'server', 'api', 'app', 'admin', 'mobile', 'desktop', 'extension']
// en un monorepo con web y app móvil, lo principal suele ser la web
const PRIORITY: ProjectType[] = ['PLUGIN', 'BROWSER_EXTENSION', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'DESKTOP_APP', 'WEB_SITE', 'API', 'LIBRARY']

export function subDirs(dir: string): string[] {
  const out: string[] = []
  for (const name of SUBPROJECTS) {
    const p = path.join(dir, name)
    try {
      if (!fs.statSync(p).isDirectory()) continue
    } catch { continue }
    // apps/* y packages/* contienen varios proyectos; el resto es un proyecto en sí
    if (name === 'apps' || name === 'packages') {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith('.')) out.push(path.join(p, e.name))
    } else out.push(p)
  }
  return out.slice(0, 20)
}

function readPkg(dir: string): Pkg | null {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as Pkg } catch { return null }
}

/** Tipo y dominios de los subproyectos de un monorepo. */
export function detectFromSubprojects(dir: string): { type?: ProjectType; platform?: Platform; domains: string[] } {
  let best: { type?: ProjectType; platform?: Platform } = {}
  const domains = new Set<string>()
  for (const sub of subDirs(dir)) {
    let entries: Set<string>
    try { entries = new Set(fs.readdirSync(sub)) } catch { continue }
    const pkg = readPkg(sub)
    const t = detectType(sub, entries, pkg)
    if (t.type && (!best.type || PRIORITY.indexOf(t.type) < PRIORITY.indexOf(best.type))) best = t
    for (const d of detectDomains(sub, entries, pkg)) domains.add(d)
  }
  return { ...best, domains: [...domains].slice(0, 10) }
}
