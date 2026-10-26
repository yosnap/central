/** PDF del presupuesto con @react-pdf/renderer, a partir del contenido común (`quote-doc.ts`), con los colores de la marca. */
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BrandSettings } from '@/generated/prisma/client'
import { tint } from './brand-image'
import type { DocArt } from './quote-doc-data'
import { quoteDoc, sections, type DocQuote } from './quote-doc'

const INK = '#0f1b2d'
const MUTED = '#5b6b82'
const LINE = '#d9e1ec'
const A4 = { w: 595.28, h: 841.89 }
// en puntos: react-pdf no trata un número suelto como multiplicador (1.45 sale casi a doble espacio)
const LH = '15.5pt'

const styles = ({ primary, secondary }: DocArt['colors']) => StyleSheet.create({
  // el interlineado va en cada texto y no en la página: con él en la página o en un contenedor, react-pdf no pinta el pie
  page: { paddingTop: 52, paddingHorizontal: 54, paddingBottom: 70, fontSize: 11, fontFamily: 'Helvetica', color: INK },
  text: { lineHeight: LH },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  logo: { maxWidth: 170, maxHeight: 64, objectFit: 'contain' },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: primary },
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: primary, textAlign: 'right', marginBottom: 6 },
  meta: { textAlign: 'right', color: MUTED, marginBottom: 2 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 14, lineHeight: '20pt' },
  parties: { flexDirection: 'row', gap: 16, marginBottom: 18 },
  party: { flex: 1, padding: 12, borderWidth: 1, borderColor: LINE, borderTopWidth: 3, borderTopColor: primary, borderRadius: 6 },
  partyAlt: { borderTopColor: secondary },
  label: { fontSize: 8.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED, lineHeight: LH },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: primary, marginTop: 18, marginBottom: 8 },
  p: { marginBottom: 8, lineHeight: LH },
  head: { flexDirection: 'row', backgroundColor: tint(primary, 0.9), paddingVertical: 6, paddingHorizontal: 4, fontFamily: 'Helvetica-Bold', fontSize: 10, color: primary },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 8, paddingHorizontal: 4 },
  cN: { width: 20, color: MUTED },
  cName: { flex: 1, paddingRight: 8 },
  cKind: { width: 56 },
  cWhen: { width: 120, paddingRight: 8 },
  cPct: { width: 45, textAlign: 'right' },
  cAmount: { width: 110, textAlign: 'right' },
  sum: { marginLeft: 'auto', width: 260 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: primary, marginTop: 4, paddingTop: 6, fontSize: 13, fontFamily: 'Helvetica-Bold', color: primary },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  dot: { width: 12, color: secondary },
  sign: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
  footer: { position: 'absolute', left: 66, right: 66, bottom: 26, fontSize: 8.5, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
})

/** Esquinas en L en cada esquina de la página: una exterior con el color principal y otra interior con el secundario. */
function Corners({ primary, secondary }: DocArt['colors']) {
  const outer = { position: 'absolute', width: 44, height: 44, borderColor: primary } as const
  const inner = { position: 'absolute', width: 22, height: 22, borderColor: secondary } as const
  const at = (v: 'top' | 'bottom', h: 'left' | 'right', inset: number, w: number) => ({
    [v]: inset, [h]: inset, [`border${v === 'top' ? 'Top' : 'Bottom'}Width`]: w, [`border${h === 'left' ? 'Left' : 'Right'}Width`]: w,
  })
  // un lienzo del tamaño de la página, para que las esquinas se midan desde sus bordes y no desde el contenido
  return (
    <View fixed style={{ position: 'absolute', top: 0, left: 0, width: A4.w, height: A4.h }}>
      {(['top', 'bottom'] as const).flatMap((v) => (['left', 'right'] as const).map((h) => [
        <View key={`${v}-${h}`} style={{ ...outer, ...at(v, h, 16, 3) }} />,
        <View key={`${v}-${h}-in`} style={{ ...inner, ...at(v, h, 25, 1.5) }} />,
      ]))}
    </View>
  )
}

export function QuotePdf({ q, brand, art }: { q: DocQuote; brand: BrandSettings | null; art: DocArt }) {
  const d = quoteDoc(q, brand)
  const h = sections(d)
  const s = styles(art.colors)
  const Bullets = ({ items }: { items: string[] }) => <View>{items.map((x, i) => <View key={i} style={s.bullet}><Text style={[s.dot, s.text]}>•</Text><Text style={[s.text, { flex: 1 }]}>{x}</Text></View>)}</View>
  const Paras = ({ text }: { text: string }) => <View>{text.split(/\n{2,}/).map((p, i) => <Text key={i} style={s.p}>{p}</Text>)}</View>
  const Party = ({ label, p, alt }: { label: string; p: { name: string; lines: string[] }; alt?: boolean }) => (
    <View style={alt ? [s.party, s.partyAlt] : s.party}><Text style={s.label}>{label}</Text><Text style={[s.bold, s.text]}>{p.name}</Text>{p.lines.map((l, i) => <Text key={i} style={s.text}>{l}</Text>)}</View>
  )
  const itemRow = (i: (typeof d.items)[number]) => (
    <View key={i.n} style={s.row} wrap={false}>
      <Text style={s.cN}>{i.n}</Text>
      <View style={s.cName}><Text style={[s.bold, s.text, { marginBottom: 2 }]}>{i.name}{i.quantity ? ` (${i.quantity})` : ''}</Text>{i.details && <Text style={s.muted}>{i.details}</Text>}</View>
      {d.variable && <Text style={s.cKind}>{i.kind}</Text>}
      <Text style={[s.cAmount, s.bold]}>{i.amount}</Text>
    </View>
  )
  const iban = d.iban && <Text style={[s.text, { marginTop: 6 }]}><Text style={s.bold}>Pago por transferencia: </Text>{d.iban}</Text>
  // marca de agua centrada, detrás de todo
  const wm = art.watermark && { width: 380, height: (380 * art.watermark.height) / art.watermark.width }
  return (
    <Document title={`${d.number} · ${d.title}`} author={d.brandName} subject={`Presupuesto para ${d.to.name}`}>
      <Page size="A4" style={s.page}>
        {art.watermark && wm && <Image fixed src={{ data: art.watermark.data, format: 'png' }} style={{ position: 'absolute', width: wm.width, height: wm.height, left: (A4.w - wm.width) / 2, top: (A4.h - wm.height) / 2 }} />}
        <Corners {...art.colors} />

        <View style={s.header}>
          {art.logo ? <Image src={{ data: art.logo.data, format: 'png' }} style={s.logo} /> : <Text style={s.brandName}>{d.brandName}</Text>}
          <View>
            <Text style={s.docTitle}>Presupuesto</Text>
            <Text style={s.meta}>Nº {d.number}</Text>
            <Text style={s.meta}>Fecha: {d.issued}</Text>
            {d.validUntil && <Text style={s.meta}>Válido hasta: {d.validUntil}</Text>}
          </View>
        </View>
        <Text style={s.title}>{d.title}</Text>
        <View style={s.parties}><Party label="Emisor" p={d.from} /><Party label="Cliente" p={d.to} alt /></View>

        {h.scope && <View><Text style={s.h2}>{h.scope}</Text><Paras text={d.scope!} /></View>}

        {h.items && (
          <View>
            {/* título, cabecera y primera fase van juntos: el título nunca se queda solo al pie de una página */}
            <View wrap={false}>
              <Text style={s.h2}>{h.items}</Text>
              <View style={s.head}><Text style={s.cN}>#</Text><Text style={s.cName}>Fase</Text>{d.variable && <Text style={s.cKind}>Tipo</Text>}<Text style={s.cAmount}>Importe</Text></View>
              {d.items.slice(0, 1).map(itemRow)}
            </View>
            {d.items.slice(1).map(itemRow)}
          </View>
        )}

        <View wrap={false}>
          <Text style={s.h2}>{h.summary}</Text>
          <View style={s.sum}>
            <View style={s.sumRow}><Text>Base imponible</Text><Text>{d.totals.base}</Text></View>
            <View style={s.sumRow}><Text>{d.totals.vat}</Text><Text>{d.totals.tax}</Text></View>
            <View style={s.grand}><Text>Total</Text><Text>{d.totals.total}</Text></View>
          </View>
          {d.variable && <Text style={[s.muted, { marginTop: 6 }]}>Las fases variables muestran un rango; el importe final depende de los factores indicados en cada una.</Text>}
        </View>

        {h.schedule && (
          <View wrap={false}>
            <Text style={s.h2}>{h.schedule}</Text>
            {d.schedule.map((r, i) => <View key={i} style={s.row}><Text style={[s.cWhen, s.bold, s.text]}>{r.when}</Text><Text style={[s.text, { flex: 1 }]}>{r.what}</Text></View>)}
          </View>
        )}

        {h.payments && (
          <View wrap={false}>
            <Text style={s.h2}>{h.payments}</Text>
            {d.payments.map((p, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.cName, s.text]}>{p.name}{p.due ? ` · ${p.due}` : ''}</Text><Text style={s.cPct}>{p.percent ?? ''}</Text><Text style={[s.cAmount, s.bold]}>{p.amount ?? ''}</Text>
              </View>
            ))}
            {iban}
          </View>
        )}

        {h.includes && <View wrap={false}><Text style={s.h2}>{h.includes}</Text><Bullets items={d.includes} /></View>}
        {h.excludes && <View wrap={false}><Text style={s.h2}>{h.excludes}</Text><Bullets items={d.excludes} /></View>}
        {h.third && <View wrap={false}><Text style={s.h2}>{h.third}</Text><Paras text={d.thirdPartyCosts!} /></View>}
        {h.assumptions && <View wrap={false}><Text style={s.h2}>{h.assumptions}</Text><Bullets items={d.assumptions} /></View>}
        {d.notes && <View wrap={false} style={{ marginTop: 14 }}><Paras text={d.notes} /></View>}
        {d.footer && <Text style={[s.muted, { marginTop: 10 }]}>{d.footer}</Text>}
        {!h.payments && iban}

        <View style={s.sign} wrap={false}>
          <Text>Conforme (cliente): ___________________________</Text>
          <Text>Fecha: ______________</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>{d.legal}</Text>
          <Text render={({ pageNumber, totalPages }) => `${d.number} · página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
