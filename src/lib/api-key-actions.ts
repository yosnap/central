'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'
import { generateApiKey } from './api/keys'
import { API_SCOPES } from './api/scopes'

const CreateKey = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'Elige al menos un permiso'),
})

/**
 * Crea una clave para otra app. Devuelve la clave completa una sola vez: en la BD solo queda su huella y el prefijo.
 */
export async function createApiKey(form: FormData): Promise<{ key: string; prefix: string } | { error: string }> {
  await requireSession()
  const d = CreateKey.safeParse({ name: form.get('name'), scopes: [...new Set(form.getAll('scopes').map(String))] })
  if (!d.success) return { error: d.error.issues[0]?.message ?? 'Datos no válidos' }
  const { key, prefix, hash } = generateApiKey()
  await prisma.apiKey.create({ data: { name: d.data.name, scopes: d.data.scopes, prefix, hash } })
  revalidatePath('/ajustes')
  return { key, prefix }
}

/** Revoca una clave: deja de valer al momento. No se borra, para ver qué hubo. */
export async function revokeApiKey(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  await prisma.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } })
  revalidatePath('/ajustes')
}
