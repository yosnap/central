'use server'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { requireSession } from './session'

// Explorador de carpetas para elegir raíces de escaneo. Solo lista carpetas (nunca ficheros)
// y se salta las ocultas y las que parecen de credenciales, como el escáner.
const SECRET = /(claves|api ?keys|secret|secrets|proxies|credentials|\.ssh)/i
// Volúmenes internos de macOS que no interesan como acceso directo
const SYSTEM_VOLUMES = /^(Data|Recovery|macOS|Preboot|VM|Update|xarts|iSCPreboot|Hardware)$|^tmp-mount-/
const MARKERS = ['.git', 'package.json', 'composer.json', 'pyproject.toml', 'go.mod', 'wp-config.php', 'Cargo.toml', 'pubspec.yaml']

export type FolderEntry = { name: string; path: string; isProject: boolean }
export type FolderListing = {
  path: string
  parent: string | null
  crumbs: { name: string; path: string }[]
  dirs: FolderEntry[]
  shortcuts: { name: string; path: string }[]
  error?: string
}

function shortcuts() {
  const out = [{ name: 'Inicio', path: os.homedir() }]
  try {
    for (const v of fs.readdirSync('/Volumes')) {
      const p = path.join('/Volumes', v)
      if (!v.startsWith('.') && !SYSTEM_VOLUMES.test(v) && fs.statSync(p).isDirectory()) out.push({ name: v, path: p })
    }
  } catch { /* sin /Volumes */ }
  return out
}

export async function browseFolder(target?: string): Promise<FolderListing> {
  await requireSession()
  const start = fs.existsSync('/ruta/a/tus/proyectos') ? '/ruta/a/tus/proyectos' : os.homedir()
  const dir = path.resolve(target || start)
  const parts = dir.split(path.sep).filter(Boolean)
  const crumbs = [{ name: '/', path: '/' }, ...parts.map((name, i) => ({ name, path: '/' + parts.slice(0, i + 1).join('/') }))]
  const base = { path: dir, parent: dir === '/' ? null : path.dirname(dir), crumbs, shortcuts: shortcuts() }
  try {
    const dirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SECRET.test(e.name))
      .map((e) => {
        const p = path.join(dir, e.name)
        return { name: e.name, path: p, isProject: MARKERS.some((m) => fs.existsSync(path.join(p, m))) }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    return { ...base, dirs }
  } catch {
    return { ...base, dirs: [], error: 'No se puede abrir esta carpeta' }
  }
}
