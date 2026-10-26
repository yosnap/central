import { Fragment, type ReactNode } from 'react'

/** Negrita, cursiva y código dentro de una línea. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).filter(Boolean).map((t, i) =>
    t.startsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong>
      : t.startsWith('`') ? <code key={i} className="rounded bg-ground px-1 font-mono text-sm">{t.slice(1, -1)}</code>
        : t.startsWith('_') && t.endsWith('_') && t.length > 2 ? <em key={i}>{t.slice(1, -1)}</em>
          : <Fragment key={i}>{t}</Fragment>)
}

function Grid({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows
  return (
    <table className="w-full border-collapse text-sm">
      <thead><tr>{head.map((c, i) => <th key={i} className="border-b border-line px-2 py-1.5 text-left font-semibold">{inline(c)}</th>)}</tr></thead>
      <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line px-2 py-1.5">{inline(c)}</td>)}</tr>)}</tbody>
    </table>
  )
}

/** Markdown básico de las respuestas del asistente: párrafos, títulos, listas y tablas. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []
  let grid: string[][] = []
  const flush = () => {
    if (grid.length) blocks.push(<Grid key={blocks.length} rows={grid} />)
    grid = []
    if (para.length) blocks.push(<p key={blocks.length}>{para.flatMap((l, i) => (i ? [<br key={i} />, ...inline(l)] : inline(l)))}</p>)
    para = []
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul'
      blocks.push(<Tag key={blocks.length} className={list.ordered ? 'list-decimal pl-6' : 'list-disc pl-6'}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>)
    }
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const head = line.match(/^#{1,4}\s+(.*)$/)
    if (!line.trim()) { flush(); continue }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!grid.length) flush()
      // la fila separadora (|---|---|) no se pinta
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) grid.push(line.trim().slice(1, -1).split('|').map((c) => c.trim()))
      continue
    }
    if (grid.length) flush()
    if (head) { flush(); blocks.push(<p key={blocks.length} className="font-semibold">{inline(head[1])}</p>); continue }
    if (bullet || num) {
      const ordered = !bullet
      if (para.length || (list && list.ordered !== ordered)) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? num)![1])
      continue
    }
    if (list) flush()
    para.push(line)
  }
  flush()
  return <div className="flex flex-col gap-3 text-base leading-relaxed">{blocks}</div>
}
