/**
 * Bidi formatting (spec 380 F24/F26/F27, ticket 384): ranges, pairs and `n / m` are one
 * string, the FSI helper wraps whole values, and no isolate ever reaches an export.
 */
import { describe, expect, it } from 'vitest'
import type { GridApi } from 'ag-grid-community'

import { formatDateTime } from './date-format'
import { FSI, PDI, formatCount, formatPair, formatRange, fsi, stripIsolates } from './bidi'
import { gridSheet } from './grid-xlsx'

const ISOLATES = /[⁦-⁩]/

describe('formatRange', () => {
  it('formatRange returns one string with both ends', () => {
    expect(formatRange('18:00', '21:00')).toBe('18:00–21:00')
    // Ends that carry their own hyphen or space space the dash, so it reads as the range's.
    expect(formatRange('2026-09-05', '2026-09-12')).toBe('2026-09-05 – 2026-09-12')
    expect(formatRange('10:00 AM', '12:00 PM')).toBe('10:00 AM – 12:00 PM')
    expect(formatRange(1, 20)).toBe('1–20')
    expect(formatRange('18:00', '21:00')).not.toMatch(ISOLATES)
  })

  it('is the other end alone when one end is blank, and blank when both are', () => {
    expect(formatRange('18:00', '')).toBe('18:00')
    expect(formatRange(null, '21:00')).toBe('21:00')
    expect(formatRange(undefined, null)).toBe('')
  })

  it('keeps equal ends — collapsing a same-day span is the caller’s rule', () => {
    expect(formatRange('09:00', '09:00')).toBe('09:00–09:00')
  })
})

describe('formatPair', () => {
  it('is one `code · name` string, or the side that is there', () => {
    expect(formatPair('1001', 'Riyadh')).toBe('1001 · Riyadh')
    expect(formatPair('JAH', 'خالد ن.')).toBe('JAH · خالد ن.')
    expect(formatPair('', 'Riyadh')).toBe('Riyadh')
    expect(formatPair('1001', null)).toBe('1001')
    expect(formatPair(null, undefined)).toBe('')
  })
})

describe('formatCount', () => {
  it('is one `n / m` string', () => {
    expect(formatCount(40, 200)).toBe('40 / 200')
    expect(formatCount(0, 0)).toBe('0 / 0')
  })
})

describe('fsi', () => {
  it('fsi wraps the whole value once and nothing else', () => {
    const range = formatRange('18:00', '21:00')
    expect(fsi(range)).toBe(`${FSI}18:00–21:00${PDI}`)
    // Once: a second pass never nests.
    expect(fsi(fsi(range))).toBe(fsi(range))
    // The whole value: one opener at the start, one closer at the end, none inside.
    const wrapped = fsi('40 / 200')
    expect([...wrapped].filter((c) => c === FSI)).toHaveLength(1)
    expect([...wrapped].filter((c) => c === PDI)).toHaveLength(1)
    expect(wrapped.slice(1, -1)).toBe('40 / 200')
    // Nothing else: a number is stringified, a blank stays blank.
    expect(fsi(-5)).toBe(`${FSI}-5${PDI}`)
    expect(fsi('')).toBe('')
    expect(fsi(null)).toBe('')
    expect(fsi(undefined)).toBe('')
  })

  it('strips back to the bare value', () => {
    expect(stripIsolates(fsi('+966558102177'))).toBe('+966558102177')
    expect(stripIsolates('⁦a⁧b⁨c⁩')).toBe('abc')
  })
})

describe('exports', () => {
  // A stand-in grid whose cells went through the formatting helpers — and whose header
  // names went through `fsi`, the one string sink F26 lets into a grid.
  type Row = { slot: [string, string]; store: [string, string]; sent: [number, number]; at: string }
  const formatted: Record<string, (row: Row) => string> = {
    slot: (row) => formatRange(...row.slot),
    store: (row) => formatPair(...row.store),
    sent: (row) => formatCount(...row.sent),
    at: (row) => formatDateTime(row.at),
  }
  const column = (colId: string) => ({
    getColDef: () => ({ headerName: fsi(`${colId} (n / m)`) }),
    getColId: () => colId,
    getActualWidth: () => 140,
  })
  const api = {
    getAllDisplayedColumns: () => Object.keys(formatted).map(column),
    forEachNodeAfterFilterAndSort: (visit: (node: { data: Row }) => void) =>
      visit({
        data: { slot: ['18:00', '21:00'], store: ['1001', 'الرياض'], sent: [40, 200], at: '2026-09-12T08:07:00' },
      }),
    getCellValue: ({ rowNode, colKey }: { rowNode: { data: Row }; colKey: { getColId: () => string } }) =>
      formatted[colKey.getColId()](rowNode.data),
  } as unknown as GridApi<Row>

  it('exports never contain FSI or PDI characters', () => {
    const sheet = gridSheet(api, 'S')
    const values = sheet.data.flat().map((cell) => String((cell as { value: unknown }).value))
    expect(values).toContain('18:00–21:00')
    expect(values).toContain('1001 · الرياض')
    expect(values).toContain('40 / 200')
    expect(values).toContain('2026-09-12 08:07')
    expect(values).toContain('slot (n / m)')
    for (const value of values) expect(value).not.toMatch(ISOLATES)
  })
})
