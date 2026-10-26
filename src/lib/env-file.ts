/** Lectura y escritura del formato de ficheros de variables (KEY=valor). Nunca registra valores. */
export type EnvEntry = { key: string; value: string }

export const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/

export function parseEnv(text: string): EnvEntry[] {
  const out = new Map<string, string>()
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/)
    if (!m) continue
    const raw = m[2]
    const q = raw[0]
    let value: string
    if (q === '"' || q === "'" || q === '`') {
      // Entre comillas puede ocupar varias líneas (claves privadas, certificados)
      let body = raw.slice(1)
      while (closingIndex(body, q) === -1 && i + 1 < lines.length) body += '\n' + lines[++i]
      const end = closingIndex(body, q)
      value = end === -1 ? body : body.slice(0, end)
      if (q === '"') value = value.replace(/\\(["\\nrt])/g, (_, c: string) => ({ n: '\n', r: '\r', t: '\t' })[c] ?? c)
    } else {
      const hash = raw.search(/\s#/)
      value = (hash === -1 ? raw : raw.slice(0, hash)).trim()
    }
    out.set(m[1], value)
  }
  return [...out].map(([key, value]) => ({ key, value }))
}

function closingIndex(s: string, q: string) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && q === '"') { i++; continue }
    if (s[i] === q) return i
  }
  return -1
}

export function formatEnv(entries: EnvEntry[]): string {
  const lines = entries.map(({ key, value }) => {
    if (value === '' || /^[A-Za-z0-9_.,:/@+\-=%]+$/.test(value)) return `${key}=${value}`
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    return `${key}="${escaped}"`
  })
  return lines.join('\n') + '\n'
}
