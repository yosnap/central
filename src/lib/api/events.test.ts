import { describe, expect, test } from 'bun:test'
import { madridDayEnd, madridDayStart } from './events'

const iso = (d: Date | null) => d?.toISOString() ?? null

describe('días de la agenda en Europe/Madrid', () => {
  test('invierno y verano', () => {
    expect(iso(madridDayStart('2026-11-18'))).toBe('2026-11-17T23:00:00.000Z')
    expect(iso(madridDayEnd('2026-11-18'))).toBe('2026-11-18T22:59:59.999Z')
    expect(iso(madridDayStart('2026-07-01'))).toBe('2026-06-30T22:00:00.000Z')
  })

  test('días del cambio de hora', () => {
    expect(iso(madridDayStart('2026-03-29'))).toBe('2026-03-28T23:00:00.000Z')
    expect(iso(madridDayEnd('2026-03-29'))).toBe('2026-03-29T21:59:59.999Z')
    expect(iso(madridDayStart('2026-10-25'))).toBe('2026-10-24T22:00:00.000Z')
    expect(iso(madridDayEnd('2026-10-25'))).toBe('2026-10-25T22:59:59.999Z')
    expect(iso(madridDayEnd('2026-12-31'))).toBe('2026-12-31T22:59:59.999Z')
  })

  test('días que no existen', () => {
    expect(madridDayStart('2026-02-31')).toBeNull()
    expect(madridDayEnd('2026-13-01')).toBeNull()
    expect(madridDayStart('18/11/2026')).toBeNull()
  })
})
