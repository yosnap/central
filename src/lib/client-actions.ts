'use server'

/** Clientes: alta, datos editables uno a uno, proyectos asignados, notas y baja. */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'
import { CLIENT_FIELDS, createClient as createClientCore, updateClient, type ClientField } from './api/mutations/clients'
import { formResult } from './api/mutations/errors'
import { createNote } from './api/mutations/notes'

function refresh(id?: string) {
  revalidatePath('/clientes')
  if (id) revalidatePath(`/clientes/${id}`)
  revalidatePath('/proyectos', 'layout')
}

const New = z.object({ name: CLIENT_FIELDS.name, company: CLIENT_FIELDS.company, email: CLIENT_FIELDS.email, phone: CLIENT_FIELDS.phone })

export async function createClient(form: FormData) {
  await requireSession()
  const r = New.safeParse(Object.fromEntries(form))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  const c = await formResult(createClientCore(r.data))
  if (c.error !== undefined) return { error: c.error }
  refresh()
  redirect(`/clientes/${c.value.id}`)
}

export async function updateClientField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(CLIENT_FIELDS) as [ClientField]).parse(form.get('field'))
  const r = CLIENT_FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  const u = await formResult(updateClient(id, { [field]: r.data }))
  if (u.error !== undefined) return { error: u.error }
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
  const n = await formResult(createNote(body, { clientId: id }, { source: 'app' }))
  if (n.error !== undefined) return { error: n.error }
  revalidatePath(`/clientes/${id}`)
}
