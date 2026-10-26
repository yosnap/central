/**
 * Sincroniza vídeos de los canales configurados en Ajustes y los asigna a los proyectos conectados.
 * YouTube: YouTube Data API v3 con clave de API (conexión YOUTUBE, secret { apiKey }).
 * Bunny Stream: API de biblioteca con AccessKey (conexión BUNNY, secret { apiKey }).
 */
import { prisma } from './prisma'
import { decryptJson } from './crypto'

interface RemoteVideo { externalId: string; title: string; url: string; thumbnail?: string; publishedAt?: Date }

async function youtubeVideos(channelId: string, apiKey: string, max = 200): Promise<RemoteVideo[]> {
  const ch = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`).then((r) => r.json())
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) throw new Error(ch.error?.message ?? 'Canal de YouTube no encontrado')
  const out: RemoteVideo[] = []
  let page = ''
  while (out.length < max) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploads}&key=${apiKey}${page ? `&pageToken=${page}` : ''}`).then((x) => x.json())
    if (r.error) throw new Error(r.error.message)
    for (const it of r.items ?? []) {
      const id = it.snippet?.resourceId?.videoId
      if (!id) continue
      out.push({ externalId: id, title: it.snippet.title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: it.snippet.thumbnails?.medium?.url, publishedAt: it.snippet.publishedAt ? new Date(it.snippet.publishedAt) : undefined })
    }
    if (!r.nextPageToken) break
    page = r.nextPageToken
  }
  return out
}

async function bunnyVideos(libraryId: string, apiKey: string): Promise<RemoteVideo[]> {
  const out: RemoteVideo[] = []
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos?page=${page}&itemsPerPage=100&orderBy=date`, { headers: { AccessKey: apiKey, accept: 'application/json' } })
    if (!res.ok) throw new Error(`Bunny respondió ${res.status}`)
    const r = await res.json()
    for (const v of r.items ?? []) {
      out.push({ externalId: v.guid, title: v.title, url: `https://iframe.mediadelivery.net/play/${libraryId}/${v.guid}`, publishedAt: v.dateUploaded ? new Date(v.dateUploaded) : undefined })
    }
    if ((r.items ?? []).length < 100) break
  }
  return out
}

export async function syncChannel(channelId: string) {
  const ch = await prisma.videoChannel.findUniqueOrThrow({ where: { id: channelId }, include: { connection: true, links: true } })
  try {
    const apiKey = decryptJson<{ apiKey: string }>(ch.connection?.secret)?.apiKey
    if (!apiKey) throw new Error('El canal no tiene una conexión con clave de API')
    const videos = ch.provider === 'YOUTUBE' ? await youtubeVideos(ch.externalId, apiKey) : await bunnyVideos(ch.externalId, apiKey)
    let assigned = 0
    for (const link of ch.links) {
      const m = link.match?.trim().toLowerCase()
      for (const v of videos.filter((x) => !m || x.title.toLowerCase().includes(m))) {
        await prisma.projectVideo.upsert({
          where: { projectId_url: { projectId: link.projectId, url: v.url } },
          update: { title: v.title, thumbnail: v.thumbnail ?? null, publishedAt: v.publishedAt ?? null },
          create: { projectId: link.projectId, channelId: ch.id, externalId: v.externalId, title: v.title, url: v.url, thumbnail: v.thumbnail ?? null, publishedAt: v.publishedAt ?? null, purpose: link.purpose },
        })
        assigned++
      }
    }
    await prisma.videoChannel.update({ where: { id: ch.id }, data: { lastSyncAt: new Date(), lastError: null } })
    return { found: videos.length, assigned }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al sincronizar'
    await prisma.videoChannel.update({ where: { id: ch.id }, data: { lastError: msg.slice(0, 300) } })
    return { found: 0, assigned: 0, error: msg }
  }
}

export async function syncAllChannels() {
  const chs = await prisma.videoChannel.findMany({ select: { id: true, name: true } })
  const out = []
  for (const c of chs) out.push({ name: c.name, ...(await syncChannel(c.id)) })
  return out
}
