import { NextResponse } from 'next/server'
import { syncAllChannels } from '@/lib/videos'

export const dynamic = 'force-dynamic'

// Sincroniza los canales de vídeo (YouTube, Bunny). Programar 1–2 veces al día:
//   curl -fsS "https://central.tudominio.com/api/cron/videos?token=$CRON_TOKEN"
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ channels: await syncAllChannels() })
}
