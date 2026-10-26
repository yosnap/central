/** Imágenes de marca para el PDF y el Word: colores sacados del logo, logo ligero, marca de agua y esquinas. */
import sharp from 'sharp'

export type Rgb = [number, number, number]
export const DEFAULT_COLORS = { primary: '#1d4ed8', secondary: '#0f1b2d' }

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`
export const rgbOf = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
/** Mezcla un color con blanco: 0 = el color, 1 = blanco. Para fondos suaves de tabla. */
export const tint = (h: string, k: number) => hex(rgbOf(h).map((c) => c + (255 - c) * k) as Rgb)

function hsv([r, g, b]: Rgb) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: max ? d / max : 0, v: max / 255 }
}

/**
 * Los dos colores corporativos del logo: agrupa los píxeles con color (sin blancos, negros ni grises) por tono y
 * devuelve la media de los dos grupos más grandes con tonos claramente distintos.
 */
export async function logoColors(logo: Buffer): Promise<{ primary: string; secondary: string } | null> {
  const { data, info } = await sharp(logo).resize(120, 120, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const buckets = new Map<number, { n: number; sum: Rgb }>()
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue
    const px: Rgb = [data[i], data[i + 1], data[i + 2]]
    const { h, s, v } = hsv(px)
    if (s < 0.25 || v < 0.2) continue
    const k = Math.round(h / 20) % 18
    const b = buckets.get(k) ?? { n: 0, sum: [0, 0, 0] }
    b.n++; b.sum = b.sum.map((x, j) => x + px[j]) as Rgb
    buckets.set(k, b)
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n)
  if (!ranked.length) return null
  const avg = (b: { n: number; sum: Rgb }) => hex(b.sum.map((x) => x / b.n) as Rgb)
  const [first] = ranked
  const dist = (a: number, b: number) => Math.min(Math.abs(a - b), 18 - Math.abs(a - b))
  const second = ranked.find(([k]) => dist(k, first[0]) >= 3)
  return { primary: avg(first[1]), secondary: second ? avg(second[1]) : DEFAULT_COLORS.secondary }
}

/** Logo reducido (los originales pueden pesar megas) en PNG, con su tamaño. */
export async function logoForDoc(logo: Buffer, width = 600) {
  const img = sharp(logo).resize({ width, withoutEnlargement: true }).png()
  const { data, info } = await img.toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** El logo casi transparente, para ponerlo de fondo en cada página. */
export async function watermark(logo: Buffer, opacity = 0.06, width = 900) {
  const { data, info } = await sharp(logo).resize({ width, withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity)
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
  return { data: png, width: info.width, height: info.height }
}

/** Esquina decorativa en L con los dos colores (la de arriba a la izquierda; las demás se giran). */
export async function corner(primary: string, secondary: string, size = 240, rotate: 0 | 90 | 180 | 270 = 0) {
  const t = Math.round(size * 0.05)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <path d="M${t / 2} ${size * 0.62} V${t / 2} H${size * 0.62}" fill="none" stroke="${primary}" stroke-width="${t}" stroke-linecap="round"/>
    <path d="M${t * 3} ${size * 0.38} V${t * 3} H${size * 0.38}" fill="none" stroke="${secondary}" stroke-width="${t * 0.6}" stroke-linecap="round" opacity="0.8"/>
  </svg>`
  return sharp(Buffer.from(svg)).rotate(rotate).png().toBuffer()
}
