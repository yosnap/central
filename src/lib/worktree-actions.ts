'use server'

/** Borrar worktrees ya fusionados y limpiar los huérfanos desde la ficha del proyecto. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'
import { enqueue, isRemote, macOnline } from './worker'
import { worktreeOp } from './worktrees'

const mainPath = async (projectId: string) =>
  (await prisma.projectLocation.findFirst({ where: { projectId, kind: 'MAIN', missing: false }, select: { path: true } }))?.path ?? null

async function remote(payload: Record<string, string>) {
  if (!(await macOnline()).online) return { error: 'El Mac no está conectado: enciende el trabajador (bun run trabajador:instalar) y vuelve a intentarlo.' }
  await enqueue('worktree', payload)
}

/** Borra un worktree fusionado y sin cambios (git se niega si los tiene). */
export async function removeWorktreeAction(form: FormData) {
  await requireSession()
  const id = z.string().min(1).max(40).parse(form.get('id'))
  const loc = await prisma.projectLocation.findUniqueOrThrow({ where: { id } })
  if (loc.kind !== 'WORKTREE' || loc.missing) return { error: 'No es un worktree que se pueda borrar' }
  const repo = await mainPath(loc.projectId)
  if (!repo) return { error: 'El proyecto no tiene carpeta principal' }
  if (isRemote()) return remote({ action: 'remove', repo, path: loc.path, locationId: id })
  const r = await worktreeOp({ action: 'remove', repo, path: loc.path })
  if (!r.ok) return { error: r.error }
  await prisma.projectLocation.delete({ where: { id } })
  revalidatePath(`/proyectos/${loc.projectId}`)
}

/** Quita de git las referencias a worktrees cuya carpeta ya no existe. */
export async function pruneWorktreesAction(form: FormData) {
  await requireSession()
  const projectId = z.string().min(1).max(40).parse(form.get('projectId'))
  const repo = await mainPath(projectId)
  if (!repo) return { error: 'El proyecto no tiene carpeta principal' }
  if (isRemote()) return remote({ action: 'prune', repo, projectId })
  const r = await worktreeOp({ action: 'prune', repo })
  if (!r.ok) return { error: r.error }
  await prisma.projectLocation.deleteMany({ where: { projectId, missing: true } })
  revalidatePath(`/proyectos/${projectId}`)
}
