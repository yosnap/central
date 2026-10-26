'use client'

import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button, Menu, MenuItem, MenuLabel, MenuSeparator, Tooltip, toast } from '@/components/ui'

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => toast.success('Cambios guardados')}>Éxito</Button>
      <Button variant="secondary" onClick={() => toast.error('No se ha podido guardar')}>Error</Button>
      <Button variant="secondary" onClick={() => toast.warning('Faltan datos de despliegue')}>Advertencia</Button>
      <Button variant="secondary" onClick={() => toast.info('Sincronizando canales…', { description: 'Puede tardar unos segundos.' })}>Información</Button>
    </div>
  )
}

export function MenuDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Menu trigger={<Button variant="secondary" size="icon" aria-label="Más acciones"><MoreHorizontal className="size-5" aria-hidden /></Button>}>
        <MenuLabel>Proyecto</MenuLabel>
        <MenuItem icon={<Pencil className="size-5" aria-hidden />} onSelect={() => toast('Editar')}>Editar</MenuItem>
        <MenuItem icon={<Copy className="size-5" aria-hidden />} onSelect={() => toast('Duplicar')}>Duplicar</MenuItem>
        <MenuSeparator />
        <MenuItem danger icon={<Trash2 className="size-5" aria-hidden />} onSelect={() => toast.error('Borrar')}>Borrar</MenuItem>
      </Menu>
      <Tooltip content="Ayuda breve que aparece al pasar el ratón o con el teclado">
        <Button variant="ghost">Pasa el ratón por aquí</Button>
      </Tooltip>
    </div>
  )
}
