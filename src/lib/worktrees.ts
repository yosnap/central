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

export type WorktreeOp = { action: 'remove'; repo: string; path: string } | { action: 'prune'; repo: string }

/** Rutas absolutas sin «..». */
export const safePath = (p: string) => path.isAbsolute(p) && !p.split('/').includes('..')

export async function worktreeOp(op: WorktreeOp): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!safePath(op.repo)) return { ok: false, error: 'Ruta del repositorio no válida' }
  try {
    if (op.action === 'prune') {
      await git(op.repo, ['worktree', 'prune'])
      return { ok: true }
    }
    if (!safePath(op.path) || op.path === op.repo) return { ok: false, error: 'Ruta del worktree no válida' }
    // solo un worktree de ese repositorio, nunca la carpeta principal
    const { stdout } = await git(op.repo, ['worktree', 'list', '--porcelain'])
    const listed = stdout.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9))
    if (!listed.slice(1).includes(op.path)) return { ok: false, error: 'Esa carpeta no es un worktree de este repositorio' }
    await git(op.repo, ['worktree', 'remove', op.path])
    return { ok: true }
  } catch (e) {
    const msg = ((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n').pop() ?? ''
    return { ok: false, error: /contains modified or untracked files|is dirty/.test(msg) ? 'El worktree tiene cambios sin guardar: no se borra' : msg.slice(0, 300) }
  }
}
