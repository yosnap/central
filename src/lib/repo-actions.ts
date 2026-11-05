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

const DEFAULT_HOST = { GITHUB: 'github.com', GITLAB: 'gitlab.com', GITEA: '' } as const
// «https://github.com/», «GitHub.com/yosnap» o vacío (el del proveedor) → «github.com»
const hostOf = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '')
const TokenForm = z.object({
  provider: z.enum(['GITHUB', 'GITLAB', 'GITEA']),
  host: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/, 'Servidor no válido: escribe solo el dominio, por ejemplo github.com o git.miempresa.com'),
  account: z.string().trim().transform((v) => v.replace(/^@/, '').replace(/^\/+|\/+$/g, '')).pipe(z.string().max(200).regex(/^[\w.\-/]*$/, 'Cuenta u organización no válida: escribe solo su nombre, por ejemplo humanitek')).optional(),
  label: z.string().trim().max(80).optional(),
  token: z.string().trim().min(8, 'Pega el token completo').max(500, 'Ese token es demasiado largo'),
})

/** Token de acceso a la API de un proveedor (GitHub, GitLab o Gitea, también autoalojados). Se guarda cifrado. */
export async function addRepoToken(form: FormData) {
  await requireSession()
  const provider = form.get('provider') as keyof typeof DEFAULT_HOST
  const r = TokenForm.safeParse({ ...Object.fromEntries(form), host: hostOf(form.get('host')) || DEFAULT_HOST[provider] })
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  const d = r.data
  const baseUrl = `https://${d.host}`
  const account = d.account || null
  // un token por servidor y cuenta: volver a añadirlo lo sustituye
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: d.provider, baseUrl, account } })
  const data = { provider: d.provider, label: d.label || (account ? `${d.host}/${account}` : d.host), account, baseUrl, secret: encryptJson({ token: d.token }), lastError: null }
  if (existing) await prisma.integrationConnection.update({ where: { id: existing.id }, data })
  else await prisma.integrationConnection.create({ data })
  // los remotos de ese servidor (y de esa cuenta, si se indicó) pasan a ese proveedor y se vuelven a consultar
  const where = { host: d.host, ...(account ? { path: { startsWith: `${account}/`, mode: 'insensitive' as const } } : {}) }
  await prisma.repoRemote.updateMany({ where, data: { provider: d.provider } })
  const ids = (await prisma.repoRemote.findMany({ where, select: { projectId: true } })).map((r) => r.projectId)
  if (ids.length) await syncRepos({ projectIds: ids })
  revalidatePath('/', 'layout')
}
