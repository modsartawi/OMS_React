import { describe, expect, it } from 'vitest'
import type { CollectionInquiryRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MONEY_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  buildCollectionsColumns,
  buildCollectionsDefaultColDef,
  resultCurrencies,
} from './collections-columns'

// Ticket 254's columns Proof: **the forensic tail hides nothing.** Every field on
// the wire row appears in exactly one of the two groups (or is named, with its
// reason, in NON_COLUMN_FIELDS), and their union is the whole row. This is the
// assertion 258's export leans on — "the file is the row unpacked, not the grid
// screenshotted" — and it is why the row is enumerated here as a VALUE: a field
// added to the contract fails typecheck on this object, and then fails the union.

const ROW: CollectionInquiryRow = {
  collectionReceiptId: '01J0COLLECT0000000000000001',
  collectionReceiptNo: 91234,
  storeId: '1001',
  storeName: 'Al Dawaa — Olaya',
  collectorOperatorId: '4472',
  collectorName: 'Faisal Al Otaibi',
  closerOperatorId: '7781',
  closerName: 'Noura Al Harbi',
  openedAt: '2026-08-08T07:00:00',
  closedAt: '2026-08-08T15:04:00',
  collectedAt: '2026-08-08T15:40:00',
  salesDate: '2026-08-08T00:00:00',
  systemCash: 12_480.5,
  countedCash: 12_475,
  variance: -5.5,
  varianceReasonCode: 'SHORT',
  varianceReasonText: 'Counted short at close',
  openingFloat: 500,
  countedCashNet: 11_975,
  retainedFloat: 500,
  netCollected: 11_975,
  cardTotal: 8_310.25,
  cardTransactionCount: 96,
  zReportIds: 'Z-88121,Z-88122',
  currencyKey: 'SAR',
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof CollectionInquiryRow)[]

// A translator that echoes its key, so a header assertion reads as "which key",
// never as "which English word" (the bundle is 253's, and this is a pure test).
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never

describe('the two groups account for the whole wire row', () => {
  it('their union plus the argued non-columns IS the row', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...NON_COLUMN_FIELDS]
    expect([...covered].sort()).toEqual([...WIRE_FIELDS].sort())
  })

  it('no field is in two places — exactly one, not at least one', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...NON_COLUMN_FIELDS]
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('the default nine are the ticket’s nine, in reading order', () => {
    expect([...DEFAULT_FIELDS]).toEqual([
      'collectionReceiptNo',
      'storeId',
      'storeName',
      'collectorName',
      'collectedAt',
      'netCollected',
      'variance',
      'cardTotal',
      'varianceReasonCode',
    ])
  })

  it('the tail leads with the WPF’s remaining ten, in the ticket’s order', () => {
    expect([...MORE_FIELDS].slice(0, 10)).toEqual([
      'openedAt',
      'closedAt',
      'systemCash',
      'countedCash',
      'openingFloat',
      'countedCashNet',
      'cardTransactionCount',
      'varianceReasonText',
      'collectorOperatorId',
      'zReportIds',
    ])
  })

  it('only the document’s ULID is withheld from the grid', () => {
    expect([...NON_COLUMN_FIELDS]).toEqual(['collectionReceiptId'])
  })

  it('every money field is one of the row’s own fields', () => {
    for (const field of MONEY_FIELDS) expect(WIRE_FIELDS).toContain(field)
  })
})

describe('buildCollectionsColumns', () => {
  it('shows the default nine with the toggle off', () => {
    const columns = buildCollectionsColumns(t, [ROW], false)
    expect(columns.map((c) => c.colId)).toEqual([...DEFAULT_FIELDS])
  })

  it('reveals the tail with the toggle on, and folds NOTHING away doing it', () => {
    const columns = buildCollectionsColumns(t, [ROW], true)
    expect(columns.map((c) => c.colId)).toEqual([...DEFAULT_FIELDS, ...MORE_FIELDS])
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildCollectionsColumns(t, [ROW], true)) {
      expect(String(column.headerName)).toContain('collections.columns.')
    }
  })

  it('puts the currency in the money HEADER, once, not in every cell', () => {
    const netCollected = buildCollectionsColumns(t, [ROW], false).find(
      (c) => c.colId === 'netCollected',
    )
    expect(netCollected?.headerName).toBe(
      'collections.moneyHeader|{"label":"collections.columns.netCollected","currency":"SAR"}',
    )
  })

  it('renders a figure to the ROW’s currency, not the header’s', () => {
    const column = buildCollectionsColumns(t, [ROW], false).find((c) => c.colId === 'cardTotal')
    const format = column?.valueFormatter as (p: unknown) => string
    // BHD draws three decimals even though the header says whatever it says.
    expect(format({ value: 8310.25, data: { ...ROW, currencyKey: 'BHD' } })).toBe('8,310.250')
    expect(format({ value: 8310.25, data: ROW })).toBe('8,310.25')
  })

  it('leaves a missing figure BLANK rather than 0.00', () => {
    const column = buildCollectionsColumns(t, [ROW], false).find((c) => c.colId === 'variance')
    const format = column?.valueFormatter as (p: unknown) => string
    expect(format({ value: null, data: ROW })).toBe('')
    expect(format({ value: undefined, data: ROW })).toBe('')
    // …and a real zero is still a zero. "No value" and "zero" stay distinguishable.
    expect(format({ value: 0, data: ROW })).toBe('0.00')
  })

  it('right-aligns money, and does NOT treat the card-slip COUNT as money', () => {
    const columns = buildCollectionsColumns(t, [ROW], true)
    const slips = columns.find((c) => c.colId === 'cardTransactionCount')
    expect(slips?.valueFormatter).toBeUndefined()
    expect(slips?.cellClass).toContain('text-end')
    for (const field of MONEY_FIELDS) {
      expect(columns.find((c) => c.colId === field)?.cellClass).toContain('text-end')
    }
  })

  it('filters dates on what is ON SCREEN, not on the raw ISO value', () => {
    // The filter row is on by default, so this is the first thing tried: typing
    // the `2026-08-08 15:40` in the cell must match the row it came from.
    const columns = buildCollectionsColumns(t, [ROW], true)
    for (const [colId, expected] of [
      ['collectedAt', '2026-08-08 15:40'],
      ['openedAt', '2026-08-08 07:00'],
      ['closedAt', '2026-08-08 15:04'],
      ['salesDate', '2026-08-08'],
    ] as const) {
      const get = columns.find((c) => c.colId === colId)?.filterValueGetter as (
        p: unknown,
      ) => string
      expect(get({ data: ROW })).toBe(expected)
    }
  })

  it('blanks the year-1 sales-date sentinel instead of printing 0001-01-01', () => {
    const column = buildCollectionsColumns(t, [ROW], true).find((c) => c.colId === 'salesDate')
    const format = column?.valueFormatter as (p: unknown) => string
    expect(format({ value: '0001-01-01T00:00:00', data: ROW })).toBe('')
    expect(format({ value: '2026-08-08T00:00:00', data: ROW })).toBe('2026-08-08')
  })
})

describe('a result that mixes currencies', () => {
  const BHD: CollectionInquiryRow = { ...ROW, storeId: '9001', currencyKey: 'BHD' }

  it('counts only real currencies — a blank one is not a second', () => {
    expect(resultCurrencies([ROW, { ...ROW, currencyKey: '  ' }])).toEqual(['SAR'])
    expect(resultCurrencies([ROW, BHD]).sort()).toEqual(['BHD', 'SAR'])
    expect(resultCurrencies([])).toEqual([])
  })

  it('drops the header code — a bare label beats a wrong one', () => {
    const netCollected = buildCollectionsColumns(t, [ROW, BHD], false).find(
      (c) => c.colId === 'netCollected',
    )
    expect(netCollected?.headerName).toBe('collections.columns.netCollected')
  })

  it('promotes the Currency column even with the tail folded away', () => {
    expect(buildCollectionsColumns(t, [ROW, BHD], false).map((c) => c.colId)).toEqual([
      ...DEFAULT_FIELDS,
      'currencyKey',
    ])
    // …and it is not duplicated when the tail is open.
    const open = buildCollectionsColumns(t, [ROW, BHD], true).map((c) => c.colId)
    expect(open.filter((id) => id === 'currencyKey')).toHaveLength(1)
  })
})

describe('the floating filter row', () => {
  it('is ON by default — the deliberate inversion of BBY Inquiry', () => {
    expect(buildCollectionsDefaultColDef(true).floatingFilter).toBe(true)
  })

  it('is off when the supervisor reclaims the height', () => {
    expect(buildCollectionsDefaultColDef(false).floatingFilter).toBe(false)
  })
})
