'use client'

import { ImageUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'

/** Logo de la marca: el actual y un botón para elegir otro (se sube al guardar el formulario). */
export function LogoPicker({ hasLogo, version }: { hasLogo: boolean; version: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const src = preview?.url ?? (hasLogo ? `/api/marca/logo?v=${version}` : null)
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-20 w-44 place-items-center overflow-hidden rounded-xl border border-line bg-white p-2">
        {src ? <img src={src} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted">Sin logo</span>}
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}><ImageUp className="size-5" aria-hidden />{hasLogo || preview ? 'Cambiar logo' : 'Elegir logo'}</Button>
        <span className="text-sm text-muted">{preview ? `${preview.name}: se sube al guardar` : 'PNG o JPG, hasta 1 MB'}</span>
      </div>
      <input ref={input} type="file" name="logo" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (preview) URL.revokeObjectURL(preview.url)
          setPreview(f ? { url: URL.createObjectURL(f), name: f.name } : null)
        }} />
    </div>
  )
}
