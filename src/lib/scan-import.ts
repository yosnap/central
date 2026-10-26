/**
 * Escanea carpetas raíz e importa los proyectos a la BD. Lo usan `scripts/scan.ts`,
 * el botón «Escanear ahora» de Ajustes y la tarea programada del Mac.
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from './prisma'
import { type FetchMode, type ScannedProject } from './scanner'
import { pathMap, scanRoots, type PathMap } from './scan-roots'

export { pathMap, scanRoots, type PathMap }

/**
 * Raíces a escanear: las indicadas; si no, las guardadas (se gestionan en Ajustes) que existan en este equipo;
 * y solo si no hay ninguna guardada, SCAN_ROOTS, que sirve para la primera vez.
 */
export async function resolveRoots(given: string[] = []): Promise<string[]> {
  if (given.length) return given
  const saved = await prisma.scanRoot.findMany({ select: { path: true } })
  if (saved.length) return saved.map((r) => r.path).filter((p) => fs.existsSync(p))
  return (process.env.SCAN_ROOTS ?? '').split(';').filter(Boolean)
}

/**
 * Proyecto ya registrado: por su identidad (remoto normalizado) o, si el repositorio ha cambiado
 * de titular, de organización o de nombre, por su carpeta principal. Solo la principal, para no
 * adueñarse de copias que pertenecen a otro proyecto.
 */
async function findExisting(p: ScannedProject) {
  const bySlug = await prisma.project.findUnique({ where: { slug: p.slug } })
  if (bySlug) return { project: bySlug, moved: false }
  const loc = await prisma.projectLocation.findFirst({ where: { path: p.main.absPath, kind: 'MAIN' }, include: { project: true } })
  return loc ? { project: loc.project, moved: true } : null
}

/** `exists` dice si una carpeta sigue en el disco: en el Mac, el disco; en producción, lo que respondió el trabajador. */
export async function importProjects(all: ScannedProject[], roots: string[], { mapPath, unmapPath }: PathMap, log: (m: string) => void = () => {}, exists: (p: string) => boolean = fs.existsSync) {
  const now = new Date()
  const moved: { from: string; to: string }[] = []
  const seenIds = new Set<string>()
  for (const p of all) {
    const client = p.clientName
      ? await prisma.client.upsert({ where: { name: p.clientName }, update: {}, create: { name: p.clientName } })
      : null
    const found = await findExisting(p)
    const existing = found?.project
    const data = {
      name: existing?.name ?? p.name,
      kind: existing?.kind ?? p.kind,
      status: existing?.statusLocked ? existing.status : p.status,
      description: existing?.description ?? p.main.description ?? null,
      version: p.main.codeVersion ?? p.main.version ?? null,
      localVersion: p.main.version ?? null,
      branchVersions: p.main.branchVersions ?? undefined,
      framework: p.main.framework ?? null,
      stack: p.main.stack,
      // un repositorio escrito a mano manda; y una carpeta sin remoto no borra el que ya había
      repoUrl: existing?.repoLocked ? existing.repoUrl : (p.main.remote ?? existing?.repoUrl ?? null),
      defaultBranch: p.main.branch ?? null,
      lastCommitAt: p.main.lastCommitAt ?? null,
      lastCommitMsg: p.main.lastCommitMsg ?? null,
      commitCount: p.main.commitCount ?? null,
      uncommitted: p.main.uncommitted ?? null,
      untracked: p.main.untracked ?? null,
      hasClaudeMd: p.main.hasClaudeMd,
      lastActivityAt: p.lastActivityAt ?? null,
      clientId: existing?.clientId ?? client?.id ?? null,
      // propuestas del escáner: siempre se recalculan; type, platform y parentId son del usuario
      suggestedType: p.main.suggestedType ?? (p.kind === 'TRAINING' ? 'CONTENT' : null),
      suggestedPlatform: p.main.suggestedPlatform ?? null,
      suggestedDomains: p.main.domains,
      // estado frente a origin (solo si la carpeta principal es un repositorio)
      ...(p.main.git ? {
        branchStatus: p.main.git.branches,
        localOnlyBranches: p.main.git.localOnly,
        remoteOnlyBranches: p.main.git.remoteOnly,
        stashCount: p.main.git.stash,
        aheadTotal: p.main.git.aheadTotal,
        behindTotal: p.main.git.behindTotal,
        behindAuthors: p.main.git.behindAuthors,
        rewrittenCommits: p.main.git.rewritten,
        lastFetchAt: p.main.git.lastFetchAt ?? null,
        ...(p.main.fetched ? { fetchError: p.main.fetchError ?? null } : {}),
      } : {}),
      // en el Mac: compose, URL de desarrollo y nombres de ficheros de variables (sin abrirlos)
      ...(p.main.local ? { envFiles: p.main.local.envFiles, localCompose: p.main.local.compose, composeProject: p.main.local.composeProject, localUrl: p.main.local.devUrl } : {}),
      scannedAt: now,
      goneAt: null, // está en el disco
    }
    if (found?.moved && existing) {
      moved.push({ from: existing.slug, to: p.slug })
      log(`  Movido: ${existing.slug} → ${p.slug}`)
    }
    // Si solo llegan worktrees de un proyecto ya registrado, se añaden sus ubicaciones sin tocar los datos del proyecto
    const project = existing && p.onlyWorktrees
      ? existing
      : existing
        ? await prisma.project.update({ where: { id: existing.id }, data: { ...data, slug: p.slug } })
        : await prisma.project.create({ data: { slug: p.slug, ...data } })
    seenIds.add(project.id)

    if (!p.onlyWorktrees) await saveRemotes(project.id, p.main.remotes)

    for (const l of p.locations) {
      const loc = {
        kind: l.kind, branch: l.dir.branch ?? null, version: l.dir.version ?? null, modifiedAt: l.dir.modifiedAt ?? null,
        uncommitted: l.dir.uncommitted ?? null, untracked: l.dir.untracked ?? null, lastCommitAt: l.dir.lastCommitAt ?? null, merged: l.dir.merged ?? null, missing: !!l.dir.missing,
      }
      await prisma.projectLocation.upsert({
        where: { path: l.dir.absPath },
        update: { ...loc, projectId: project.id, scannedAt: now },
        create: { ...loc, path: l.dir.absPath, projectId: project.id },
      })
    }
    // Ubicaciones antiguas cuya carpeta ya no existe y que git tampoco apunta: se quitan
    const seen = p.locations.map((l) => l.dir.absPath)
    const stale = await prisma.projectLocation.findMany({ where: { projectId: project.id, path: { notIn: seen } }, select: { id: true, path: true } })
    const gone = stale.filter((s) => !exists(unmapPath(s.path))).map((s) => s.id)
    if (gone.length) await prisma.projectLocation.deleteMany({ where: { id: { in: gone } } })
  }
  const gone = await markGone(seenIds, roots, { mapPath, unmapPath }, now, log, exists)
  for (const r of roots) {
    const rp = mapPath(path.resolve(r))
    await prisma.scanRoot.upsert({ where: { path: rp }, update: { lastScanAt: now, found: all.length }, create: { path: rp, lastScanAt: now, found: all.length } })
  }
  return { projects: all.length, moved, gone }
}

/**
 * Proyectos que el escaneo no ha encontrado y de los que no queda ninguna carpeta: se marcan «sin carpeta» (goneAt)
 * para que Pendientes pregunte si eliminarlos o unirlos al proyecto renombrado. Solo cuentan las carpetas que están
 * dentro de una raíz escaneada que existe: con el disco externo desconectado no se marca nada.
 */
async function markGone(seenIds: Set<string>, roots: string[], { mapPath, unmapPath }: PathMap, now: Date, log: (m: string) => void, exists: (p: string) => boolean) {
  const scanned = roots.filter((r) => exists(r)).map((r) => mapPath(path.resolve(r)).replace(/\/$/, '') + '/')
  if (!scanned.length) return 0
  const candidates = await prisma.project.findMany({
    where: { id: { notIn: [...seenIds] }, goneAt: null },
    select: { id: true, name: true, locations: { select: { path: true } } },
  })
  let n = 0
  for (const p of candidates) {
    if (!p.locations.length) continue
    const inScanned = p.locations.every((l) => scanned.some((r) => `${l.path}/`.startsWith(r)))
    if (!inScanned || p.locations.some((l) => exists(unmapPath(l.path)))) continue
    await prisma.project.update({ where: { id: p.id }, data: { goneAt: now } })
    log(`  Sin carpeta: ${p.name}`)
    n++
  }
  return n
}

/** Guarda los remotos de la carpeta principal y quita los que ya no existen. */
export async function saveRemotes(projectId: string, remotes: ScannedProject['main']['remotes']) {
  for (const r of remotes) {
    await prisma.repoRemote.upsert({
      where: { projectId_name: { projectId, name: r.name } },
      // si la API ya identificó el proveedor (p. ej. Gitea en un host propio), se respeta
      update: { url: r.url, host: r.host, path: r.path, ...(r.provider !== 'OTHER' ? { provider: r.provider } : {}) },
      create: { projectId, name: r.name, url: r.url, host: r.host, path: r.path, provider: r.provider },
    })
  }
  await prisma.repoRemote.deleteMany({ where: { projectId, name: { notIn: remotes.map((r) => r.name) } } })
}

let running = false

/** Escaneo completo con las raíces guardadas. Evita dos escaneos a la vez en el mismo proceso. */
export async function scanAndImport(given: string[] = [], mapArg?: string, log?: (m: string) => void, fetch: FetchMode = 'none') {
  if (running) throw new Error('Ya hay un escaneo en marcha')
  running = true
  try {
    const roots = await resolveRoots(given)
    if (!roots.length) throw new Error('No hay carpetas que escanear')
    const map = pathMap(mapArg)
    const all = scanRoots(roots, map, log, fetch)
    return { roots, ...(await importProjects(all, roots, map, log)) }
  } finally {
    running = false
  }
}
