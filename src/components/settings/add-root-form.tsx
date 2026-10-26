'use client'

import { useState } from 'react'
import { addScanRoot } from '@/lib/settings-actions'
import { ActionForm, Field, Input, SubmitButton } from '@/components/ui'
import { FolderPicker } from '@/components/folder-picker'

/** Añadir una carpeta raíz: escribiéndola o eligiéndola con el explorador. */
export function AddRootForm() {
  const [path, setPath] = useState('')
  return (
    <ActionForm action={addScanRoot} success="Carpeta añadida y escaneada" onSuccess={() => setPath('')} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <Field label="Añadir carpeta" htmlFor="new-root" hint="Elígela con «Explorar…» o escribe la ruta completa. Se escanea en el momento.">
        <Input id="new-root" name="path" required value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Volumes/…" className="font-mono" />
      </Field>
      <div className="self-start md:mt-9"><FolderPicker onPick={setPath} initialPath={path || undefined} /></div>
      <SubmitButton className="self-start md:mt-9" pendingText="Escaneando…">Añadir y escanear</SubmitButton>
    </ActionForm>
  )
}
