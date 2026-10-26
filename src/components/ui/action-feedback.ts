'use client'

import { unstable_rethrow } from 'next/navigation'
import { toast } from 'sonner'

const FALLBACK = 'No se ha podido completar. Revisa los datos e inténtalo de nuevo.'

/**
 * Ejecuta una Server Action y avisa con un toast. Deja pasar las redirecciones de Next.
 * Una acción puede devolver `{ error: 'texto' }` para explicar qué falla (en producción Next oculta el mensaje de lo que se lanza).
 */
export async function runAction(action: (form: FormData) => unknown, form: FormData, msg: { success?: string; error?: string } = {}) {
  try {
    const r = await action(form)
    if (r && typeof r === 'object' && 'error' in r && typeof r.error === 'string') {
      toast.error(r.error)
      return false
    }
    if (msg.success) toast.success(msg.success)
    return true
  } catch (e) {
    unstable_rethrow(e)
    toast.error(msg.error ?? FALLBACK)
    return false
  }
}
