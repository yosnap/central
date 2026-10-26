'use client'

import { useRouter } from 'next/navigation'

/**
 * Vuelve a pedir la página cada pocos segundos mientras se muestre (p. ej. mientras el Mac hace un trabajo).
 * El intervalo vive en la función ref: React 19 la llama al montar y ejecuta su limpieza al desmontar.
 */
export function AutoRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter()
  return (
    <span hidden ref={() => {
      const t = setInterval(() => router.refresh(), every)
      return () => clearInterval(t)
    }} />
  )
}
