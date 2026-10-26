/** Word (.docx) del presupuesto con la librería `docx`, a partir del contenido común (`quote-doc.ts`). */
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TextRun, TextWrappingType, VerticalPositionRelativeFrom, WidthType,
} from 'docx'
import type { BrandSettings } from '@/generated/prisma/client'
import { corner, tint } from './brand-image'
import type { DocArt } from './quote-doc-data'
import { quoteDoc, sections, type DocQuote } from './quote-doc'

const MUTED = '5B6B82'
const LINE = 'D9E1EC'
const FONT = 'Arial'
// A4 con márgenes de 1100 twips: ancho útil en twips, para que las tablas ocupen todo el ancho en Word y en otros visores
const PAGE = { width: 11906, height: 16838, margin: 1100 }
const W = PAGE.width - 2 * PAGE.margin

/** Escala la imagen para que quepa en el recuadro sin deformarse. */
const fit = (s: { w: number; h: number }, maxW: number, maxH: number) => { const k = Math.min(maxW / s.w, maxH / s.h, 1); return { width: Math.round(s.w * k), height: Math.round(s.h * k) } }

const run = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) => new TextRun({ text, font: FONT, size: o.size ?? 22, bold: o.bold, color: o.color, italics: o.italics })
const para = (children: TextRun[], o: { after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) => new Paragraph({ children, spacing: { after: o.after ?? 80 }, alignment: o.align })
const paras = (text: string) => text.split(/\n{2,}/).map((p) => para([run(p)], { after: 120 }))
const bullets = (items: string[]) => items.map((x) => new Paragraph({ children: [run(x)], bullet: { level: 0 }, spacing: { after: 60 } }))

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const line = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }
const cell = (children: Paragraph[], o: { width?: number; fill?: string } = {}) => new TableCell({
  children, width: o.width ? { size: Math.round((W * o.width) / 100), type: WidthType.DXA } : undefined,
  shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  borders: { top: none, left: none, right: none, bottom: line },
  margins: { top: 80, bottom: 80, left: 80, right: 80 },
})
const txt = (text: string, o: { bold?: boolean; color?: string; right?: boolean; keepNext?: boolean } = {}) =>
  new Paragraph({ children: [run(text, o)], spacing: { after: 0 }, alignment: o.right ? AlignmentType.RIGHT : undefined, keepNext: o.keepNext })
/** Tabla a todo el ancho con columnas en %; solo línea fina bajo cada fila. */
const table = (cols: number[], rows: TableRow[]) => new Table({
  rows, width: { size: W, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: cols.map((c) => Math.round((W * c) / 100)), borders: noBorders,
})

/** Imagen flotante detrás del texto, colocada en la página en píxeles (96 por pulgada). */
const behind = (data: Buffer, w: number, h: number, x: number, y: number) => new ImageRun({
  type: 'png', data, transformation: { width: w, height: h },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(x * 9525) },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(y * 9525) },
    behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
  },
})

/** Marca de agua centrada y las cuatro esquinas en L, en la cabecera para que salgan en todas las páginas. */
async function decoration(art: DocArt) {
  const page = { w: 794, h: 1123 } // A4 en píxeles
  const out: ImageRun[] = []
  if (art.watermark) {
    const w = 500, h = Math.round((w * art.watermark.height) / art.watermark.width)
    out.push(behind(art.watermark.data, w, h, (page.w - w) / 2, (page.h - h) / 2))
  }
  const size = 62, inset = 20
  const spots = [[0, inset, inset], [90, page.w - inset - size, inset], [270, inset, page.h - inset - size], [180, page.w - inset - size, page.h - inset - size]] as const
  for (const [rot, x, y] of spots) out.push(behind(await corner(art.colors.primary, art.colors.secondary, 240, rot), size, size, x, y))
  return out
}

export async function quoteDocx(q: DocQuote, brand: BrandSettings | null, art: DocArt) {
  const ACCENT = art.colors.primary.slice(1).toUpperCase()
  const SOFT = tint(art.colors.primary, 0.9).slice(1).toUpperCase()
  // keepNext: un título nunca se queda solo al pie de una página
  const h2 = (text: string) => new Paragraph({ children: [run(text, { bold: true, color: ACCENT, size: 26 })], spacing: { before: 300, after: 120 }, keepNext: true })
  const head = { fill: SOFT }
  const d = quoteDoc(q, brand)
  const h = sections(d)
  const out: (Paragraph | Table)[] = []

  // cabecera: logo o nombre a la izquierda; número y fechas a la derecha
  const logoPara = art.logo
    ? new Paragraph({ children: [new ImageRun({ type: 'png', data: art.logo.data, transformation: fit({ w: art.logo.width, h: art.logo.height }, 190, 68) })] })
    : para([run(d.brandName, { bold: true, size: 34, color: ACCENT })])
  const half = { size: Math.round(W / 2), type: WidthType.DXA }
  out.push(new Table({
    width: { size: W, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [half.size, half.size], borders: noBorders,
    rows: [new TableRow({ children: [
      new TableCell({ width: half, children: [logoPara], borders: { top: none, bottom: none, left: none, right: none } }),
      new TableCell({ width: half, borders: { top: none, bottom: none, left: none, right: none }, children: [
        para([run('PRESUPUESTO', { bold: true, color: ACCENT, size: 40 })], { align: AlignmentType.RIGHT }),
        txt(`Nº ${d.number}`, { color: MUTED, right: true }), txt(`Fecha: ${d.issued}`, { color: MUTED, right: true }),
        ...(d.validUntil ? [txt(`Válido hasta: ${d.validUntil}`, { color: MUTED, right: true })] : []),
      ] }),
    ] })],
  }))
  out.push(new Paragraph({ children: [run(d.title, { bold: true, size: 28 })], spacing: { before: 240, after: 200 } }))

  const party = (label: string, p: { name: string; lines: string[] }) => [txt(label.toUpperCase(), { color: MUTED }), txt(p.name, { bold: true }), ...p.lines.map((l) => txt(l))]
  out.push(new Table({
    width: { size: W, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [half.size, half.size], borders: { ...noBorders, insideVertical: line, top: line, bottom: line, left: line, right: line },
    rows: [new TableRow({ children: [party('Emisor', d.from), party('Cliente', d.to)].map((c) => new TableCell({ children: c, width: half, borders: { top: line, bottom: line, left: line, right: line }, margins: { top: 120, bottom: 120, left: 120, right: 120 } })) })],
  }))

  if (h.scope) out.push(h2(h.scope), ...paras(d.scope!))

  if (h.items) {
    out.push(h2(h.items), table(d.variable ? [5, 63, 12, 20] : [5, 75, 20], [
      new TableRow({ tableHeader: true, cantSplit: true, children: [cell([txt('#', { bold: true, keepNext: true })], { width: 5, ...head }), cell([txt('Fase', { bold: true, keepNext: true })], { width: d.variable ? 63 : 75, ...head }), ...(d.variable ? [cell([txt('Tipo', { bold: true, keepNext: true })], { width: 12, ...head })] : []), cell([txt('Importe', { bold: true, right: true, keepNext: true })], { width: 20, ...head })] }),
      ...d.items.map((i) => new TableRow({ cantSplit: true, children: [
        cell([txt(String(i.n), { color: MUTED })]),
        cell([txt(`${i.name}${i.quantity ? ` (${i.quantity})` : ''}`, { bold: true }), ...(i.details ? [txt(i.details, { color: MUTED })] : [])]),
        ...(d.variable ? [cell([txt(i.kind)])] : []),
        cell([txt(i.amount, { right: true })]),
      ] })),
    ]))
  }

  out.push(h2(h.summary!), table([70, 30], [
    new TableRow({ children: [cell([txt('Base imponible')], { width: 70 }), cell([txt(d.totals.base, { right: true })], { width: 30 })] }),
    new TableRow({ children: [cell([txt(d.totals.vat)]), cell([txt(d.totals.tax, { right: true })])] }),
    new TableRow({ children: [cell([txt('TOTAL', { bold: true })], head), cell([txt(d.totals.total, { bold: true, right: true })], head)] }),
  ]))
  if (d.variable) out.push(para([run('Las fases variables muestran un rango; el importe final depende de los factores indicados en cada una.', { color: MUTED, italics: true })], { after: 0 }))

  if (h.schedule) out.push(h2(h.schedule), table([30, 70], d.schedule.map((r) => new TableRow({ children: [cell([txt(r.when, { bold: true })], { width: 30 }), cell([txt(r.what)], { width: 70 })] }))))
  if (h.payments) {
    out.push(h2(h.payments), table([60, 15, 25], d.payments.map((p) => new TableRow({ children: [cell([txt(`${p.name}${p.due ? ` · ${p.due}` : ''}`)], { width: 60 }), cell([txt(p.percent ?? '', { right: true })], { width: 15 }), cell([txt(p.amount ?? '', { right: true })], { width: 25 })] }))))
  }
  if (d.iban) out.push(para([run('Pago por transferencia: ', { bold: true }), run(d.iban)], { after: 0 }))
  if (h.includes) out.push(h2(h.includes), ...bullets(d.includes))
  if (h.excludes) out.push(h2(h.excludes), ...bullets(d.excludes))
  if (h.third) out.push(h2(h.third), ...paras(d.thirdPartyCosts!))
  if (h.assumptions) out.push(h2(h.assumptions), ...bullets(d.assumptions))
  if (d.notes) out.push(new Paragraph({ spacing: { before: 200 } }), ...paras(d.notes))
  if (d.footer) out.push(para([run(d.footer, { color: MUTED })]))
  out.push(new Paragraph({ spacing: { before: 600 }, children: [run('Conforme (cliente): _______________________________        Fecha: ____________')] }))

  const doc = new Document({
    creator: d.brandName, title: `${d.number} · ${d.title}`, description: `Presupuesto para ${d.to.name}`,
    // interlineado 1,25 (line en 240avos) para que el texto no quede apelotonado
    styles: { default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 300 } } } } },
    sections: [{
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: 1000, bottom: 1000, left: PAGE.margin, right: PAGE.margin } } },
      headers: { default: new Header({ children: [new Paragraph({ children: await decoration(art) })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(`${d.legal} · ${d.number} · página `, { color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }), run(' de ', { color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED })] })] }) },
      children: out,
    }],
  })
  return Packer.toBuffer(doc)
}
