/**
 * Limpieza de worktrees de git, sin forzar nunca: `git worktree remove` se niega si el worktree tiene cambios sin
 * commit o ficheros nuevos, y `git worktree prune` solo quita referencias a carpetas que ya no existen.
 * Sin Prisma: lo usan las Server Actions (Central en el Mac) y el trabajador del Mac (Central en producción).
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const git = (repo: string, args: string[]) => run('git', ['-C', repo, ...args], { timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })

/** `localBranch`: borra también la rama con `git branch -d` (solo si está fusionada). `remoteBranch`: y en origin, solo si está fusionada en origin. */
export type WorktreeOp = { action: 'remove'; repo: string; path: string; localBranch?: boolean; remoteBranch?: boolean } | { action: 'prune'; repo: string }

/** Rutas absolutas sin «..». */
export const safePath = (p: string) => path.isAbsolute(p) && !p.split('/').includes('..')

export async function worktreeOp(op: WorktreeOp): Promise<{ ok: true; notes?: string[] } | { ok: false; error: string }> {
  if (!safePath(op.repo)) return { ok: false, error: 'Ruta del repositorio no válida' }
  try {
    if (op.action === 'prune') {
      await git(op.repo, ['worktree', 'prune'])
      return { ok: true }
    }
    if (!safePath(op.path) || op.path === op.repo) return { ok: false, error: 'Ruta del worktree no válida' }
    // solo un worktree de ese repositorio, nunca la carpeta principal
    const { stdout } = await git(op.repo, ['worktree', 'list', '--porcelain'])
    const blocks = stdout.split('\n\n').map((b) => ({ path: b.match(/^worktree (.+)$/m)?.[1], branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1] }))
    const wt = blocks.slice(1).find((b) => b.path === op.path)
    if (!wt) return { ok: false, error: 'Esa carpeta no es un worktree de este repositorio' }
    await git(op.repo, ['worktree', 'remove', op.path])
    const notes = wt.branch ? await removeBranch(op.repo, wt.branch, !!op.localBranch, !!op.remoteBranch) : []
    return { ok: true, notes }
  } catch (e) {
    const msg = ((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n').pop() ?? ''
    return { ok: false, error: /contains modified or untracked files|is dirty/.test(msg) ? 'El worktree tiene cambios sin guardar: no se borra' : msg.slice(0, 300) }
  }
}

/** La línea `error:` de git (sin las pistas `hint:`), o la última. */
const lastLine = (e: unknown) => {
  const lines = ((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n').filter((l) => !l.startsWith('hint:'))
  return (lines.find((l) => l.startsWith('error:'))?.slice(7) ?? lines.pop() ?? '').slice(0, 200)
}

/** Ramas de un worktree ya borrado. Nunca fuerza: lo que no se puede borrar con seguridad se queda y se cuenta en `notes`. */
async function removeBranch(repo: string, branch: string, local: boolean, remote: boolean) {
  const notes: string[] = []
  if (local) {
    // -d (no -D): git se niega si la rama no está fusionada en la rama actual del principal
    try { await git(repo, ['branch', '-d', branch]) } catch (e) { notes.push(`La rama local ${branch} se queda: ${lastLine(e)}`) }
  }
  if (remote) {
    try {
      const base = (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
      await git(repo, ['fetch', '--quiet', 'origin', base, branch])
      // solo si todo lo de la rama en origin ya está en la rama del principal en origin
      const merged = await git(repo, ['merge-base', '--is-ancestor', `origin/${branch}`, `origin/${base}`]).then(() => true, () => false)
      if (!merged) notes.push(`La rama ${branch} de GitHub se queda: no está fusionada en origin/${base}`)
      else await git(repo, ['push', 'origin', '--delete', branch])
    } catch (e) {
      const msg = lastLine(e)
      notes.push(/couldn't find remote ref|remote ref does not exist/i.test(msg) ? `La rama ${branch} ya no estaba en GitHub` : `La rama ${branch} de GitHub se queda: ${msg}`)
    }
  }
  return notes
}
