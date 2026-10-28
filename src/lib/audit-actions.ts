'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'

const IdOnly = z.object({ id: z.string().min(1).max(40) })

/** Descarta un aviso: sigue en la ficha, pero ya no entra en Pendientes ni pone en rojo Uptime Kuma. */
export async function ignoreAdvisory(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  const a = await prisma.projectAdvisory.update({ where: { id }, data: { ignoredAt: new Date() } })
  revalidatePath(`/proyectos/${a.projectId}`)
  revalidatePath('/pendientes')
}

export async function restoreAdvisory(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  const a = await prisma.projectAdvisory.update({ where: { id }, data: { ignoredAt: null } })
  revalidatePath(`/proyectos/${a.projectId}`)
  revalidatePath('/pendientes')
}

/** Audita ahora las dependencias del proyecto; en producción se le pide al Mac, que tiene las carpetas. */
export async function auditNow(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  const { enqueue, isRemote } = await import('./worker')
  const { auditTargets, runAudit } = await import('./audit-import')
  if (isRemote()) {
    const targets = (await auditTargets()).filter((t) => t.projectId === id).map(({ projectId, path }) => ({ projectId, path }))
    if (!targets.length) return { error: 'El proyecto no está en producción o no tiene carpeta principal' }
    await enqueue('audit', { targets })
    return
  }
  if (!(await runAudit(undefined, [id]))) return { error: 'El proyecto no está en producción o no tiene carpeta principal' }
  await (await import('./kuma-push')).pushSecurity().catch(() => null)
  revalidatePath(`/proyectos/${id}`)
  revalidatePath('/pendientes')
}
