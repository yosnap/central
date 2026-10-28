'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from './prisma'
import { runServers } from './servers/collect'
import { linkContainer } from './servers/link'
import { ADMIN_USER_RE, adminPublicKey, installInfobar } from './servers/install'
import { HOST_RE, NAME_RE, trustHost } from './servers/register'
import { requireSession } from './session'
import { enqueue, isRemote, macOnline, pendingFor } from './worker'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)
const ServerForm = z.object({
  name: z.string().trim().regex(NAME_RE, 'Nombre de hasta 40 letras, números, espacios, puntos, guiones o _'),
  host: z.string().trim().regex(HOST_RE, 'Host no válido (letras, números, puntos y guiones)'),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  provider: opt(60),
  panel: opt(40),
  panelUrl: opt(300),
  adminUser: z.string().trim().max(32).optional().refine((v) => !v || ADMIN_USER_RE.test(v), 'El usuario SSH es un usuario de Linux (root, ubuntu…), no un correo').transform((v) => v || null),
  knownIps: z.string().max(2000).optional().transform((v) => (v ?? '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean).slice(0, 50)),
  allowMail: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  notes: opt(2000),
})

const refresh = () => { revalidatePath('/servidores', 'layout'); revalidatePath('/ajustes'); revalidatePath('/') }

/**
 * Lee el formulario aceptando el host como se suele copiar: «https://usuario@host:2222/ruta» se queda en «host»,
 * con el usuario como administrador y el puerto como puerto SSH si no se han escrito aparte.
 */
function readServerForm(form: FormData) {
  const raw = Object.fromEntries(form) as Record<string, string>
  const m = String(raw.host ?? '').trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').match(/^(?:([^@\s]+)@)?([^:\s]+)(?::(\d+))?$/)
  if (m) {
    raw.host = m[2]
    if (m[1] && !raw.adminUser) raw.adminUser = m[1]
    if (m[3] && (!raw.sshPort || raw.sshPort === '22')) raw.sshPort = m[3]
  }
  const r = ServerForm.safeParse(raw)
  return r.success ? { data: r.data } : { error: r.error.issues.map((i) => i.message).join('. ') }
}

/** Alta de un servidor y primera lectura. Si aún no tiene infobar, la ficha explica cómo instalarlo. */
export async function addServer(form: FormData) {
  await requireSession()
  const { data: d, error } = readServerForm(form)
  if (!d) return { error }
  if (await prisma.server.findUnique({ where: { name: d.name } })) return { error: `Ya hay un servidor llamado «${d.name}»` }
  const s = await prisma.server.create({ data: d })
  await runServers({ force: true, ids: [s.id] })
  refresh()
  redirect(`/servidores/${s.id}`)
}

const EDITABLE = ['name', 'host', 'sshPort', 'provider', 'panel', 'panelUrl', 'adminUser', 'knownIps', 'allowMail', 'notes'] as const

/** Cambia un solo dato del servidor (edición en el sitio). */
export async function updateServerField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(EDITABLE).parse(form.get('field'))
  let raw = String(form.get('value') ?? '').trim()
  if (field === 'host') {
    const m = raw.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').match(/^(?:[^@\s]+@)?([^:\s]+)(?::\d+)?$/)
    if (m) raw = m[1]
  }
  const r = ServerForm.shape[field].safeParse(field === 'sshPort' && !raw ? undefined : raw)
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  if (field === 'name') {
    const other = await prisma.server.findUnique({ where: { name: r.data as string } })
    if (other && other.id !== id) return { error: `Ya hay un servidor llamado «${r.data}»` }
  }
  // cambiar cómo se conecta obliga a leer de nuevo
  const reconnect = field === 'host' || field === 'sshPort'
  await prisma.server.update({ where: { id }, data: { [field]: r.data, ...(reconnect ? { nextAt: null, pausedUntil: null } : {}) } })
  if (reconnect || field === 'allowMail' || field === 'knownIps') await runServers({ force: true, ids: [id] })
  refresh()
}

export async function deleteServer(form: FormData) {
  await requireSession()
  await prisma.server.delete({ where: { id: z.string().min(1).parse(form.get('id')) } })
  refresh()
  redirect('/servidores')
}

export async function readServerNow(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  await prisma.server.update({ where: { id }, data: { pausedUntil: null } })
  const [r] = await runServers({ force: true, ids: [id] })
  refresh()
  if (r && !r.ok) return { error: `No se pudo leer: ${r.detail}` }
}

/** Confía en la huella que el usuario ha visto (se vuelve a pedir y debe coincidir). */
export async function trustServerHost(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const fingerprint = z.string().regex(/^SHA256:[A-Za-z0-9+/]{43}$/).parse(form.get('fingerprint'))
  const s = await prisma.server.findUniqueOrThrow({ where: { id } })
  await trustHost(s.host, s.sshPort, fingerprint)
  await prisma.server.update({ where: { id }, data: { pausedUntil: null } })
  await runServers({ force: true, ids: [id] })
  refresh()
}

/** Enlaza un servicio Docker con un proyecto (desde Servidores, Pendientes o la ficha del proyecto). */
export async function linkContainerAction(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const target = z.string().max(60).parse(form.get('target') ?? '')
  await linkContainer(id, target)
  refresh()
  revalidatePath('/pendientes')
  revalidatePath('/proyectos', 'layout')
}

/** Instala o actualiza infobar en el servidor con el usuario y la contraseña que se escriben en la ventana (no se guarda la contraseña). */
export async function installServerAction(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  // si el navegador ha rellenado el usuario con un correo guardado, se entra como root
  const typed = String(form.get('ssh_user') ?? '').trim()
  const user = ADMIN_USER_RE.test(typed) ? typed : 'root'
  const password = z.string().max(500).parse(form.get('password') ?? '')
  const s = await prisma.server.findUniqueOrThrow({ where: { id } })
  const privateKey = z.string().max(20000).parse(form.get('private_key') ?? '')
  // en producción instala el Mac con sus claves; las contraseñas y claves pegadas no pasan por la cola
  if (isRemote()) {
    if (password || privateKey) return { error: 'Desde producción el Mac instala con sus claves: deja la contraseña y la clave vacías, o instala desde Central en el Mac.' }
    if (!s.hostKey) return { error: 'Confirma primero la huella del servidor.' }
    if (!(await macOnline()).online) return { error: 'El Mac no está conectado: enciende el trabajador (bun run trabajador:instalar) y vuelve a intentarlo.' }
    if (!(await pendingFor('server-install', 'serverId', id)).length) await enqueue('server-install', { serverId: id, host: s.host, port: s.sshPort, user, hostKey: s.hostKey })
    refresh()
    return
  }
  const r = await installInfobar({ host: s.host, port: s.sshPort, user, password: password || undefined, privateKey: privateKey || undefined })
  if (!r.ok) return { error: r.log.slice(-400) }
  await prisma.server.update({ where: { id }, data: { adminUser: user, pausedUntil: null, nextAt: null } })
  await runServers({ force: true, ids: [id] })
  refresh()
}

/** Clave pública de administrador de Central, para pegarla en el panel del proveedor. */
export async function adminPublicKeyAction() {
  await requireSession()
  if (!isRemote()) return adminPublicKey()
  // en producción, la del Mac (llega con el latido del trabajador)
  const beat = await prisma.workerBeat.findUnique({ where: { id: 'mac' } })
  if (!beat?.adminKey) throw new Error('El Mac aún no ha enviado su clave: actualiza el trabajador')
  return beat.adminKey
}
