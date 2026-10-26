'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'

const refresh = () => { revalidatePath('/', 'layout') }

/** Elimina de Central un proyecto (sus carpetas ya no existen). No toca nada del disco. */
export async function deleteProjectAction(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  await prisma.project.delete({ where: { id } })
  refresh()
}

/**
 * Une un proyecto sin carpeta con el que lo sustituye (carpeta renombrada o movida): pasan servicios, webs, notas,
 * presupuestos, vídeos, secretos, copias de variables e instalaciones, y los datos que el nuevo no tenga.
 * Si algo choca (el mismo secreto en los dos), se queda el del proyecto nuevo.
 */
export async function mergeProjectAction(form: FormData) {
  await requireSession()
  const from = z.string().min(1).parse(form.get('id'))
  const into = z.string().min(1).parse(form.get('into'))
  if (from === into) return { error: 'Elige otro proyecto' }
  const [a, b] = await Promise.all([prisma.project.findUniqueOrThrow({ where: { id: from } }), prisma.project.findUniqueOrThrow({ where: { id: into } })])
  await prisma.$transaction(async (tx) => {
    const where = { projectId: from }, data = { projectId: into }
    await tx.projectService.updateMany({ where, data })
    await tx.website.updateMany({ where, data })
    await tx.note.updateMany({ where, data })
    await tx.quote.updateMany({ where, data })
    await tx.projectVideo.updateMany({ where, data })
    await tx.envBackup.updateMany({ where, data })
    await tx.project.updateMany({ where: { parentId: from }, data: { parentId: into } })
    // con clave única: solo lo que el proyecto nuevo no tiene ya
    for (const s of await tx.projectSecret.findMany({ where })) {
      const dup = await tx.projectSecret.findFirst({ where: { projectId: into, environment: s.environment, key: s.key } })
      if (!dup) await tx.projectSecret.update({ where: { id: s.id }, data })
    }
    for (const i of await tx.installation.findMany({ where })) {
      const dup = await tx.installation.findFirst({ where: { projectId: into, websiteId: i.websiteId } })
      if (!dup) await tx.installation.update({ where: { id: i.id }, data })
    }
    for (const v of await tx.videoChannelLink.findMany({ where })) {
      const dup = await tx.videoChannelLink.findFirst({ where: { projectId: into, channelId: v.channelId } })
      if (!dup) await tx.videoChannelLink.update({ where: { id: v.id }, data })
    }
    // lo que se rellenó a mano en el antiguo, si el nuevo no lo tiene
    await tx.project.update({
      where: { id: into },
      data: {
        clientId: b.clientId ?? a.clientId, phase: b.phase ?? a.phase, description: b.description ?? a.description,
        type: b.type ?? a.type, platform: b.platform ?? a.platform, hosting: b.hosting ?? a.hosting, deployedVersion: b.deployedVersion ?? a.deployedVersion,
        deployStatus: b.deployStatus === 'UNKNOWN' ? a.deployStatus : b.deployStatus, kind: b.reviewedAt ? b.kind : a.kind,
        ...(a.statusLocked && !b.statusLocked ? { status: a.status, statusLocked: true } : {}),
        ...(a.repoLocked && !b.repoLocked ? { repoUrl: a.repoUrl, repoLocked: true } : {}),
        reviewedAt: b.reviewedAt ?? a.reviewedAt,
      },
    })
    await tx.project.delete({ where: { id: from } })
  })
  refresh()
}

/** Entornos donde se lanza el proyecto (casillas de la ficha). */
export async function setProjectEnvironments(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const envs = form.getAll('environments').map(String).filter((e) => ['development', 'staging', 'production'].includes(e))
  await prisma.project.update({ where: { id }, data: { environments: envs } })
  revalidatePath(`/proyectos/${id}`)
}
