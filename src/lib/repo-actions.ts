'use server'

import fs from 'node:fs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { encryptJson } from './crypto'
import { gitFetch, readBranchState, readRemotes } from './git-state'
import { prisma } from './prisma'
import { syncRepos } from './repo-sync'
import { saveRemotes } from './scan-import'
import { requireSession } from './session'

/** Trae de origin la carpeta principal del proyecto, recalcula sus ramas y consulta al proveedor. */
export async function refreshRepo(form: FormData) {
  await requireSession()
  const id = z.string().parse(form.get('id'))
  const main = await prisma.projectLocation.findFirst({ where: { projectId: id, kind: 'MAIN' } })
  if (!main || !fs.existsSync(main.path)) throw new Error('La carpeta principal no está en este equipo')
  const remotes = readRemotes(main.path)
  const fetched = remotes.length ? gitFetch(main.path) : { ok: true }
  const git = readBranchState(main.path)
  await saveRemotes(id, remotes)
  await prisma.project.update({
    where: { id },
    data: {
      branchStatus: git.branches, localOnlyBranches: git.localOnly, remoteOnlyBranches: git.remoteOnly, stashCount: git.stash,
      aheadTotal: git.aheadTotal, behindTotal: git.behindTotal, behindAuthors: git.behindAuthors, rewrittenCommits: git.rewritten, lastFetchAt: git.lastFetchAt ?? null, fetchError: fetched.ok ? null : fetched.error ?? null,
    },
  })
  await syncRepos({ projectIds: [id] })
  revalidatePath(`/proyectos/${id}`)
  revalidatePath('/')
}

/** Consulta al proveedor todos los remotos de proyectos no excluidos. */
export async function syncAllRepos() {
  await requireSession()
  await syncRepos()
  revalidatePath('/', 'layout')
}

const TokenForm = z.object({
  provider: z.enum(['GITHUB', 'GITLAB', 'GITEA']),
  host: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  token: z.string().trim().min(8).max(500),
})

/** Token de acceso a la API de un proveedor (GitHub, GitLab o Gitea, también autoalojados). Se guarda cifrado. */
export async function addRepoToken(form: FormData) {
  await requireSession()
  const d = TokenForm.parse(Object.fromEntries(form))
  const baseUrl = `https://${d.host}`
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: d.provider, baseUrl } })
  const data = { provider: d.provider, label: d.host, baseUrl, secret: encryptJson({ token: d.token }), lastError: null }
  if (existing) await prisma.integrationConnection.update({ where: { id: existing.id }, data })
  else await prisma.integrationConnection.create({ data })
  // los remotos de ese host pasan a ese proveedor y se vuelven a consultar
  await prisma.repoRemote.updateMany({ where: { host: d.host }, data: { provider: d.provider } })
  const ids = (await prisma.repoRemote.findMany({ where: { host: d.host }, select: { projectId: true } })).map((r) => r.projectId)
  if (ids.length) await syncRepos({ projectIds: ids })
  revalidatePath('/', 'layout')
}
