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

// Carpetas de sistema de Windows (papelera, restauración, recuperación…). Viven en la raíz de cada unidad y solo
// se ocultan ahí: más abajo, una carpeta «Recovery» o que empiece por «$» es del usuario.
const WINDOWS_ROOT_SYSTEM = /^\$|^(System Volume Information|Recovery|Config\.Msi)$/i
const isWindowsSystem = (name: string, atDriveRoot: boolean) =>
  process.platform === 'win32' && atDriveRoot && WINDOWS_ROOT_SYSTEM.test(name)

// Unidades de Windows. Comprobarlas puede tardar segundos si hay una unidad de red desconectada, así que se hace
// sin bloquear y fuera de la navegación: solo la primera vez se espera el resultado (con tope); después se sirve la
// lista conocida y se refresca por detrás como mucho cada DRIVES_REFRESH_MS.
const DRIVE_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const DRIVES_REFRESH_MS = 10_000
const DRIVES_FIRST_WAIT_MS = 1_500
const drives = new Set<string>()
let drivesCheckedAt = 0
let firstDrivesCheck: Promise<unknown> | undefined
// Una sola comprobación viva por unidad: mientras una no conteste (unidad colgada) no se lanza otra
const probing = new Map<string, Promise<void>>()

function probeDrive(letter: string): Promise<void> {
  let probe = probing.get(letter)
  if (!probe) {
    // el resultado se aplica cuando llega, tarde lo que tarde: una unidad solo sale de la lista si contesta que no existe
    probe = fs.promises.access(`${letter}:\\`).then(() => { drives.add(letter) }, () => { drives.delete(letter) }).finally(() => { probing.delete(letter) })
    probing.set(letter, probe)
  }
  return probe
}

async function windowsDrives() {
  if (Date.now() - drivesCheckedAt >= DRIVES_REFRESH_MS) {
    drivesCheckedAt = Date.now()
    const all = Promise.all(DRIVE_LETTERS.map(probeDrive))
    firstDrivesCheck ??= Promise.race([all, new Promise((resolve) => setTimeout(resolve, DRIVES_FIRST_WAIT_MS))])
  }
  await firstDrivesCheck
  return DRIVE_LETTERS.filter((letter) => drives.has(letter)).map((letter) => ({ name: `${letter}:`, path: `${letter}:\\` }))
}

async function shortcuts() {
  const out = [{ name: 'Inicio', path: os.homedir() }]
  if (process.platform === 'win32') return [...out, ...(await windowsDrives())]
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
  // la primera carpeta de SCAN_ROOTS si existe; si no, la carpeta personal
  const root = (process.env.SCAN_ROOTS ?? '').split(';').find((r) => r && fs.existsSync(r))
  const start = root ?? os.homedir()
  const dir = path.resolve(target || start)
  // migas de pan con rutas absolutas reales (nada de reconstruirlas a mano: en Windows
  // la raíz es «C:\», no «/», y una ruta inventada como «/C:/Users» no resuelve bien ahí)
  const dirRoot = path.parse(dir).root
  const rootName = dirRoot.length > 1 ? dirRoot.slice(0, -1) : dirRoot
  const rest = dir.slice(dirRoot.length).split(path.sep).filter(Boolean)
  const crumbs = [{ name: rootName, path: dirRoot }]
  let acc = dirRoot
  for (const name of rest) {
    acc = path.join(acc, name)
    crumbs.push({ name, path: acc })
  }
  const base = { path: dir, parent: dir === dirRoot ? null : path.dirname(dir), crumbs, shortcuts: await shortcuts() }
  try {
    const dirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SECRET.test(e.name) && !isWindowsSystem(e.name, dir === dirRoot))
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
