/** Compara versiones tipo 1.2.3 (con o sin «v»). Devuelve <0, 0 o >0; null si alguna no es numérica. */
export function compareVersions(a?: string | null, b?: string | null): number | null {
  const parse = (v?: string | null) => v?.trim().replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(Number)
  const x = parse(a)
  const y = parse(b)
  if (!x || !y || x.some(Number.isNaN) || y.some(Number.isNaN)) return null
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}
