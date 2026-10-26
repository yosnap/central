'use client'

import { Toaster as Sonner } from 'sonner'

export { toast } from 'sonner'

/** Contenedor de avisos (toasts). Va una sola vez en el layout raíz. */
export function Toaster() {
  return <Sonner position="bottom-right" theme="system" richColors closeButton duration={4500} toastOptions={{ className: '!text-base !rounded-2xl !px-5 !py-4' }} />
}
