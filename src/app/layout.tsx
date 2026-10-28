import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import { pendingCount } from '@/lib/pending'
import { ALERT_KIND_LABEL, collectAlerts } from '@/lib/alerts'
import { Sidebar } from '@/components/sidebar'
import { Toaster, TooltipProvider } from '@/components/ui'
import './globals.css'

export const metadata: Metadata = { title: 'Central', description: 'CRM personal de Paulo · iServisat' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  const pending = signedIn ? await pendingCount().catch(() => null) : null
  const all = signedIn ? await collectAlerts().catch(() => null) : null
  // a la campana solo viajan las más graves; el resto está en /alertas
  const alerts = all && {
    total: all.length, critical: all.filter((a) => a.level === 'critical').length,
    alerts: all.slice(0, 8).map(({ key, level, kind, title, detail, href }) => ({ key, level, kind: ALERT_KIND_LABEL[kind], title, detail, href })),
  }
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        <TooltipProvider>
          <div className="flex min-h-screen flex-col lg:flex-row">
            {signedIn && <Sidebar pending={pending} alerts={alerts} />}
            <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto w-full max-w-[2000px]">{children}</div>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
