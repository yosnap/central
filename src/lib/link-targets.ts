/** Opciones para ligar un evento o un correo: clientes («c:<id>») y proyectos («p:<id>»), juntos en un buscador. */
import { prisma } from './prisma'

export async function linkTargets() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { excluded: false, goneAt: null, kind: { in: ['CLIENT', 'OWN'] } }, select: { id: true, name: true, client: { select: { name: true } } }, orderBy: { name: 'asc' } }),
  ])
  const options = [
    ...clients.map((c) => ({ value: `c:${c.id}`, label: c.name, hint: 'cliente' })),
    ...projects.map((p) => ({ value: `p:${p.id}`, label: p.name, hint: p.client ? `proyecto de ${p.client.name}` : 'proyecto' })),
  ]
  return { options, clients }
}

/** Cliente que encaja con unas direcciones de correo: por correo exacto o, si no, por el dominio (salvo gmail y similares). */
export function clientFor(emails: string[], clients: { id: string; name: string; email: string | null }[]) {
  const generic = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|proton(mail)?)\./i
  const exact = clients.find((c) => c.email && emails.includes(c.email.toLowerCase()))
  if (exact) return exact
  const domains = emails.filter((e) => !generic.test(e)).map((e) => e.split('@')[1])
  return clients.find((c) => c.email && !generic.test(c.email) && domains.includes(c.email.toLowerCase().split('@')[1])) ?? null
}

/** «c:<id>» es un cliente y «p:<id>», un proyecto (con su cliente); vacío, sin ligar. */
export async function resolveTarget(v: string) {
  if (v.startsWith('p:')) {
    const p = await prisma.project.findUnique({ where: { id: v.slice(2) }, select: { id: true, clientId: true } })
    return { projectId: p?.id ?? null, clientId: p?.clientId ?? null }
  }
  return { clientId: v.startsWith('c:') ? v.slice(2) : null, projectId: null }
}
