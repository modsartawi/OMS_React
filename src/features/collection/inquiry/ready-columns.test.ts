import { describe, expect, it } from 'vitest'
import type { CollectionReadyRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MONEY_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  SLIP_FIELDS,
  buildReadyColumns,
  buildReadyDefaultColDef,
} from './ready-columns'
import { READY_DAY, READY_DAY_BHD, READY_DAY_NO_Z, READY_RECEIPT } from './ready-fixture'

// Ticket 317's columns Proof: store (as the server prints it), profit center,
// business day, Z number, cash to hand over, surplus deducted, days waiting — and
// the forensic tail hides nothing (254's union assertion).

const WIRE_FIELDS = Object.keys(READY_DAY) as (keyof CollectionReadyRow)[]

// A translator that echoes its key, so a header assertion reads as "which key".
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never

const format = (colId: string, row: CollectionReadyRow, rows = [row]) => {
  const column = buildReadyColumns(t, rows, true).find((c) => c.colId === colId)
  const formatter = column?.valueFormatter as ((p: unknown) => string) | undefined
  const value = row[colId as keyof CollectionReadyRow]
  return formatter ? formatter({ value, data: row }) : String(value)
}

describe('the two groups account for the whole wire row', () => {
  it('their union plus the slip-gated column and the argued non-columns IS the row', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...SLIP_FIELDS, ...NON_COLUMN_FIELDS]
    expect([...covered].sort()).toEqual([...WIRE_FIELDS].sort())
  })

  it('no field is in two places', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...SLIP_FIELDS, ...NON_COLUMN_FIELDS]
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('the landing grid is the ticket’s columns in reading order — what, where, which day, how much, how long', () => {
    expect([...DEFAULT_FIELDS]).toEqual([
      'kind',
      'storeText',
      'storeName',
      'businessDay',
      'zNumber',
      'entryNumber',
      'cashToHandOver',
      'surplusDeducted',
      'readySince',
      'daysWaiting',
      // Ticket 320: the day's card figure closes the set — the Slips column follows it.
      'cardTotal',
    ])
  })

  it('nothing is withheld — every wire field is on the grid or in its tail', () => {
    expect([...NON_COLUMN_FIELDS]).toEqual([])
  })

  it('exactly the three money fields are money — cardTotal on its neighbours’ terms', () => {
    expect([...MONEY_FIELDS]).toEqual(['cashToHandOver', 'surplusDeducted', 'cardTotal'])
  })
})

describe('the Slips column (ticket 320)', () => {
  const slips = (rows = [READY_DAY], showMore = false) => buildReadyColumns(t, rows, showMore, true)
  const slipCell = (row: CollectionReadyRow) => {
    const column = slips([row]).find((c) => c.colId === 'slipCount')
    const value = (column?.valueGetter as (p: unknown) => unknown)({ data: row })
    return (column?.valueFormatter as (p: unknown) => string)({ value, data: row })
  }

  it('is hidden unless the probe admits — the default is hidden', () => {
    expect(buildReadyColumns(t, [READY_DAY], true).map((c) => c.colId)).not.toContain('slipCount')
    expect(buildReadyColumns(t, [READY_DAY], true, false).map((c) => c.colId)).not.toContain('slipCount')
  })

  it('lands right after the card total, on the landing grid and with the tail open', () => {
    expect(slips().map((c) => c.colId)).toEqual([...DEFAULT_FIELDS, 'slipCount'])
    const withTail = slips([READY_DAY], true).map((c) => c.colId)
    expect(withTail.indexOf('slipCount')).toBe(withTail.indexOf('cardTotal') + 1)
  })

  it('draws a count as sent, a real 0 as 0, and null as the dash', () => {
    expect(slipCell(READY_DAY)).toBe('2')
    expect(slipCell(READY_DAY_NO_Z)).toBe('0')
    expect(slipCell(READY_RECEIPT)).toBe('—')
  })

  it('its header is a t() key, and it is not a link yet (the drawer is 321’s)', () => {
    const column = slips().find((c) => c.colId === 'slipCount')
    expect(column?.headerName).toBe('slips.column')
    expect(column?.onCellClicked).toBeUndefined()
  })
})

describe('buildReadyColumns', () => {
  it('shows the default set with the toggle off, and the tail with it on', () => {
    expect(buildReadyColumns(t, [READY_DAY], false).map((c) => c.colId)).toEqual([...DEFAULT_FIELDS])
    expect(buildReadyColumns(t, [READY_DAY], true).map((c) => c.colId)).toEqual([
      ...DEFAULT_FIELDS,
      ...MORE_FIELDS,
    ])
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildReadyColumns(t, [READY_DAY], true))
      expect(String(column.headerName)).toContain('ready.columns.')
  })

  it('🚩 the store column is the SERVER’s storeText, as sent — never re-derived here', () => {
    const column = buildReadyColumns(t, [READY_DAY], false).find((c) => c.colId === 'storeText')
    expect(column?.field).toBe('storeText')
    expect(column?.valueFormatter).toBeUndefined()
    expect(format('storeText', READY_DAY)).toBe('PH-019 (P019)')
    // No profit center recorded: the code alone, because that is what the server sent.
    expect(format('storeText', READY_DAY_BHD)).toBe('B004')
  })

  it('the raw profit center is in the tail, as sent', () => {
    expect(MORE_FIELDS).toContain('profitCenter')
    expect(format('profitCenter', READY_DAY)).toBe('PH-019')
  })

  it('names the kind through a t() key', () => {
    expect(format('kind', READY_DAY)).toBe('ready.kinds.DAY')
    expect(format('kind', READY_RECEIPT)).toBe('ready.kinds.SETTLEMENT')
    // An unknown kind shows itself, never a raw key.
    expect(format('kind', { ...READY_DAY, kind: 'HOLD' })).toBe('HOLD')
  })

  it('🚩 draws a dash for every absence — a receipt’s day, Z and surplus; a day with no Z yet', () => {
    expect(format('businessDay', READY_RECEIPT)).toBe('—')
    expect(format('zNumber', READY_RECEIPT)).toBe('—')
    expect(format('surplusDeducted', READY_RECEIPT)).toBe('—')
    expect(format('entryNumber', READY_DAY)).toBe('—')
    expect(format('zNumber', READY_DAY_NO_Z)).toBe('—')
    expect(format('cashToHandOver', READY_DAY_NO_Z)).toBe('—')
    expect(format('surplusDeducted', READY_DAY_NO_Z)).toBe('—')
  })

  it('draws the contract sample’s figures to its currency', () => {
    expect(format('businessDay', READY_DAY)).toBe('2026-09-20')
    expect(format('zNumber', READY_DAY)).toBe('412')
    expect(format('cashToHandOver', READY_DAY)).toBe('1,000.50')
    expect(format('surplusDeducted', READY_DAY)).toBe('250.00')
    expect(format('entryNumber', READY_RECEIPT)).toBe('143')
    expect(format('cashToHandOver', READY_RECEIPT)).toBe('120.50')
    expect(format('readySince', READY_DAY)).toBe('2026-09-20 23:05')
    expect(format('daysWaiting', READY_DAY)).toBe('5')
  })

  it('renders a figure to the ROW’s currency — a BHD day in a mixed list keeps its third decimal', () => {
    expect(format('cashToHandOver', READY_DAY_BHD, [READY_DAY, READY_DAY_BHD])).toBe('95.255')
  })

  it('one currency → the code in the money headers; mixed → bare headers and the Currency column promoted', () => {
    const single = buildReadyColumns(t, [READY_DAY, READY_RECEIPT], false)
    expect(single.find((c) => c.colId === 'cashToHandOver')?.headerName).toBe(
      'ready.moneyHeader|{"label":"ready.columns.cashToHandOver","currency":"SAR"}',
    )
    expect(single.map((c) => c.colId)).not.toContain('currencyKey')

    const mixed = buildReadyColumns(t, [READY_DAY, READY_DAY_BHD], false)
    expect(mixed.find((c) => c.colId === 'cashToHandOver')?.headerName).toBe('ready.columns.cashToHandOver')
    expect(mixed.map((c) => c.colId)).toContain('currencyKey')
  })

  it('the numeric columns filter as numbers and right-align', () => {
    const columns = buildReadyColumns(t, [READY_DAY], true)
    for (const colId of ['cashToHandOver', 'surplusDeducted', 'daysWaiting', 'zNumber', 'entryNumber']) {
      const column = columns.find((c) => c.colId === colId)
      expect(column?.filter).toBe('agNumberColumnFilter')
      expect(String(column?.cellClass)).toContain('text-end')
    }
  })

  it('🔑 card total: the figure to the row’s currency, and a dash for null — never 0.000', () => {
    expect(format('cardTotal', READY_DAY)).toBe('640.00')
    expect(format('cardTotal', READY_DAY_BHD, [READY_DAY, READY_DAY_BHD])).toBe('12.345')
    expect(format('cardTotal', READY_RECEIPT)).toBe('—')
    expect(format('cardTotal', READY_DAY_NO_Z)).toBe('—')
    // A real 0 (a mirrored Z with no CARD line) is a figure, not an absence.
    expect(format('cardTotal', { ...READY_DAY, cardTotal: 0 })).toBe('0.00')
  })

  it('card total goes in the currency header on the same terms as its neighbours', () => {
    const single = buildReadyColumns(t, [READY_DAY], false)
    expect(single.find((c) => c.colId === 'cardTotal')?.headerName).toBe(
      'ready.moneyHeader|{"label":"ready.columns.cardTotal","currency":"SAR"}',
    )
    const mixed = buildReadyColumns(t, [READY_DAY, READY_DAY_BHD], false)
    expect(mixed.find((c) => c.colId === 'cardTotal')?.headerName).toBe('ready.columns.cardTotal')
  })

  it('the floating filter row follows the toggle', () => {
    expect(buildReadyDefaultColDef(true).floatingFilter).toBe(true)
    expect(buildReadyDefaultColDef(false).floatingFilter).toBe(false)
  })
})
