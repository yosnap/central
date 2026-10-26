'use client'

import { ArrowUp, ChevronRight, Folder, FolderGit2, FolderOpen, HardDrive, Home, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { browseFolder, type FolderListing } from '@/lib/folder-actions'
import { Button, Modal, Notice, Pill, cn } from '@/components/ui'

/** Explorador de carpetas del equipo donde corre Central. Devuelve la ruta elegida. */
export function FolderPicker({ onPick, initialPath }: { onPick: (path: string) => void; initialPath?: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<FolderListing | null>(null)
  const [loading, start] = useTransition()

  const go = (p?: string) => start(async () => setData(await browseFolder(p)))
  const openPicker = () => {
    setOpen(true)
    go(initialPath || data?.path)
  }
  const pick = () => {
    if (!data) return
    onPick(data.path)
    setOpen(false)
  }

  return (
    <>
      <Button variant="secondary" onClick={openPicker}><FolderOpen className="size-5" aria-hidden />Explorar…</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Elegir carpeta"
        description="Entra en las carpetas y elige la que quieras escanear. Se escanea entera, con sus subcarpetas."
        footer={
          <>
            <span className="mr-auto truncate self-center font-mono text-sm text-muted">{data?.path}</span>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={pick} disabled={!data || loading}>Elegir esta carpeta</Button>
          </>
        }
      >
        {data && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {data.shortcuts.map((s) => (
                <Button key={s.path} variant={data.path === s.path ? 'primary' : 'ghost'} size="sm" onClick={() => go(s.path)}>
                  {s.name === 'Inicio' ? <Home className="size-4" aria-hidden /> : <HardDrive className="size-4" aria-hidden />}{s.name}
                </Button>
              ))}
            </div>
            <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 rounded-xl bg-ground px-3 py-2 text-sm">
              {data.parent && (
                <Button variant="ghost" size="sm" onClick={() => go(data.parent!)} aria-label="Subir un nivel"><ArrowUp className="size-4" aria-hidden /></Button>
              )}
              {data.crumbs.map((c, i) => (
                <span key={c.path} className="flex items-center gap-1">
                  {i > 1 && <ChevronRight className="size-4 text-muted" aria-hidden />}
                  <button type="button" onClick={() => go(c.path)} className={cn('cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-accent-soft', i === data.crumbs.length - 1 && 'font-semibold text-accent-strong')}>{c.name}</button>
                </span>
              ))}
              {loading && <Loader2 className="ml-auto size-4 animate-spin text-muted" aria-label="Cargando" />}
            </nav>
            {data.error && <Notice tone="bad" title={data.error} />}
            {!data.error && data.dirs.length === 0 && <p className="py-6 text-center text-muted">Esta carpeta no tiene subcarpetas.</p>}
            <ul className="grid max-h-[50vh] gap-1 overflow-y-auto sm:grid-cols-2">
              {data.dirs.map((d) => (
                <li key={d.path}>
                  <button
                    type="button"
                    onClick={() => go(d.path)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {d.isProject ? <FolderGit2 className="size-5 shrink-0 text-accent" aria-hidden /> : <Folder className="size-5 shrink-0 text-muted" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {d.isProject && <Pill tone="accent">Proyecto</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!data && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted" aria-label="Cargando" /></div>}
      </Modal>
    </>
  )
}
