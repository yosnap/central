import { NextResponse } from 'next/server'
import { runUptime } from '@/lib/uptime'

export const dynamic = 'force-dynamic'

// Llamar cada 5–15 min desde Easypanel (cron), n8n o un cron del sistema:
//   curl -fsS "https://central.tudominio.com/api/cron/uptime?token=$CRON_TOKEN"
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const results = await runUptime()
  return NextResponse.json({ checked: results.length, down: results.filter((r) => !r.up).map((r) => r.url) })
}
