'use server'

/** Clientes: alta, datos editables uno a uno, proyectos asignados, notas y baja. */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null)

const FIELDS = {
  name: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(120),
  company: opt(160),
  email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, 'El correo no es válido').transform((v) => v || null),
  phone: opt(40),
  taxId: opt(30),
  address: opt(500),
} as const

function refresh(id?: string) {
  revalidatePath('/clientes')
  if (id) revalidatePath(`/clientes/${id}`)
  revalidatePath('/proyectos', 'layout')
}

async function nameTaken(name: string, id?: string) {
  const other = await prisma.client.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
  return !!other && other.id !== id
}

const New = z.object({ name: FIELDS.name, company: FIELDS.company, email: FIELDS.email, phone: FIELDS.phone })

export async function createClient(form: FormData) {
  await requireSession()
  const r = New.safeParse(Object.fromEntries(form))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  if (await nameTaken(r.data.name)) return { error: `Ya hay un cliente llamado «${r.data.name}»` }
  const c = await prisma.client.create({ data: r.data })
  refresh()
  redirect(`/clientes/${c.id}`)
}

export async function updateClientField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(FIELDS) as [keyof typeof FIELDS]).parse(form.get('field'))
  const r = FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  if (field === 'name' && (await nameTaken(r.data as string, id))) return { error: `Ya hay un cliente llamado «${r.data}»` }
  await prisma.client.update({ where: { id }, data: { [field]: r.data } })
  refresh(id)
}

export async function deleteClient(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const quotes = await prisma.quote.count({ where: { clientId: id } })
  if (quotes) return { error: `Tiene ${quotes} presupuesto${quotes === 1 ? '' : 's'}: bórralos o pásalos a otro cliente antes` }
  // proyectos y webs quedan sin cliente; sus notas se borran con él
  await prisma.client.delete({ where: { id } })
  refresh()
  redirect('/clientes')
}

/** Asigna un proyecto existente al cliente: pasa a ser trabajo de cliente y sus webs sin cliente también son suyas. */
export async function assignProject(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const projectId = z.string().min(1, 'Elige un proyecto').safeParse(form.get('value'))
  if (!projectId.success) return { error: 'Elige un proyecto' }
  await prisma.project.update({ where: { id: projectId.data }, data: { clientId: id, kind: 'CLIENT' } })
  await prisma.website.updateMany({ where: { projectId: projectId.data, clientId: null }, data: { clientId: id } })
  refresh(id)
  revalidatePath(`/proyectos/${projectId.data}`)
}

export async function unassignProject(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const projectId = z.string().min(1).parse(form.get('projectId'))
  await prisma.project.update({ where: { id: projectId, clientId: id }, data: { clientId: null } })
  await prisma.website.updateMany({ where: { projectId, clientId: id }, data: { clientId: null } })
  refresh(id)
  revalidatePath(`/proyectos/${projectId}`)
}

export async function addClientNote(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const body = z.string().trim().max(5000).parse(form.get('body') ?? '')
  if (!body) return { error: 'La nota está vacía' }
  await prisma.note.create({ data: { body, clientId: id, source: 'app' } })
  revalidatePath(`/clientes/${id}`)
}
