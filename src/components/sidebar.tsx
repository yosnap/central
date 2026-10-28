'use client'

import { CalendarDays, FileText, FolderGit2, Globe, LayoutDashboard, ListTodo, Mail, Server, Settings, Shapes, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertsBell, type BellAlert } from './alerts-bell'
import { Logo } from './logo'
import { cn } from './ui/cn'

const NAV = [
  { href: '/', label: 'Resumen', Icon: LayoutDashboard },
  { href: '/pendientes', label: 'Pendientes', Icon: ListTodo },
  { href: '/proyectos', label: 'Proyectos', Icon: FolderGit2 },
  { href: '/webs', label: 'Webs', Icon: Globe },
  { href: '/servidores', label: 'Servidores', Icon: Server },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/presupuestos', label: 'Presupuestos', Icon: FileText },
  { href: '/agenda', label: 'Agenda', Icon: CalendarDays },
  { href: '/correo', label: 'Correo', Icon: Mail },
  { href: '/ajustes', label: 'Ajustes', Icon: Settings },
  { href: '/componentes', label: 'Componentes', Icon: Shapes },
] as const

export function Sidebar({ pending, alerts }: { pending: { total: number; fresh: number } | null; alerts: { total: number; critical: number; alerts: BellAlert[] } | null }) {
  const path = usePathname()
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href))
  return (
    <nav aria-label="Secciones" className="sticky top-0 z-30 flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel px-4 py-3 lg:h-screen lg:w-72 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:py-8">
      <div className="mr-4 flex items-center justify-between gap-2 lg:mb-8 lg:mr-0">
        <Link href="/" className="flex items-center gap-3 px-2 text-2xl font-semibold tracking-tight">
          <Logo />
          <span className="hidden flex-col leading-tight sm:flex">
            Central
            <span className="num text-sm font-normal text-muted" title="Versión de Central (CHANGELOG.md)">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </span>
        </Link>
        {alerts && <AlertsBell {...alerts} />}
      </div>
      {NAV.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-base font-medium transition-colors',
            active(href) ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:bg-ground hover:text-ink',
          )}
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {href === '/pendientes' && pending && pending.total > 0 && (
            <span className="num rounded-full bg-warn px-2.5 py-0.5 text-sm font-semibold text-white" title={`${pending.fresh} nuevos sin revisar`}>{pending.total}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}
