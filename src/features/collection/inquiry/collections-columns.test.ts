import { describe, expect, it } from 'vitest'
import type { CollectionInquiryRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MONEY_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  SLIP_FIELDS,
  buildCollectionsColumns,
  buildCollectionsDefaultColDef,
  resultCurrencies,
} from './collections-columns'

// Ticket 254's columns Proof: **the forensic tail hides nothing.** Every field on
// the wire row appears in exactly one of the two groups (or is named, with its
// reason, in NON_COLUMN_FIELDS), and their union is the whole row. The export is
// the grid as shown (ticket 336), so a field that is in neither group could reach
// neither the screen nor the file — which is why the row is enumerated here as a
// VALUE: a field added to the contract fails typecheck on this object, and then
// fails the union.

const ROW: CollectionInquiryRow = {
  collectionReceiptId: '01J0COLLECT0000000000000001',
  collectionReceiptNo: 91234,
  storeId: '1001',
  storeName: 'Al Dawaa — Olaya',
  // BackOffice 1990's pair: the raw profit center, and the server's one spelling of it.
  profitCenter: 'PH-1001',
  storeText: 'PH-1001 (1001)',
  collectorOperatorId: '4472',
  collectorName: 'Faisal Al Otaibi',
  closerOperatorId: '7781',
  closerName: 'Noura Al Harbi',
  openedAt: '2026-08-08T07:00:00',
  closedAt: '2026-08-08T15:04:00',
  collectedAt: '2026-08-08T15:40:00',
  // A day collected late: sold on the 6th, collected on the 8th.
  businessDay: '2026-08-06T00:00:00',
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
  // BackOffice 2034: the store day's slip count, keyed by THIS row's businessDay.
  slipCount: 2,
  // BackOffice 2151: finance's figures. A regular day — amount + surplus = net.
  collectionType: 'Regular',
  hasSurplus: false,
  hasTheft: false,
  theftAmount: 0,
  amount: 11_975,
  surplus: 0,
  description: '',
  // Sent before 335, declared by it.
  cashSales: 11_975,
  settlement: 0,
  settlementAdjustmentTotal: 0,
  settlementEntryNumber: 0,
  settlementDescription: '',
  shiftSettlementAdjustment: 0,
  shiftSettlementEntryNumber: 0,
  shiftCardTotal: 8_310.25,
  receiptKind: 'SHIFT',
  isSettlement: false,
  collectionStatus: 'COLLECTED',
  isOffSystem: false,
  offSystemAt: null,
  offSystemBy: '',
  offSystemReasonCode: '',
  offSystemReasonText: '',
  zNumber: 412,
  amendmentCount: 0,
  lastAmendedBy: '',
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof CollectionInquiryRow)[]

// A translator that echoes its key, so a header assertion reads as "which key",
// never as "which English word" (the bundle is 253's, and this is a pure test).
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never

describe('the two groups account for the whole wire row', () => {
  it('their union plus the slip-gated column and the argued non-columns IS the row', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...SLIP_FIELDS, ...NON_COLUMN_FIELDS]
    expect([...covered].sort()).toEqual([...WIRE_FIELDS].sort())
  })

  it('no field is in two places — exactly one, not at least one', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...SLIP_FIELDS, ...NON_COLUMN_FIELDS]
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('the tail leads with the six that left the landing grid, then the WPF’s remaining nine', () => {
    expect([...MORE_FIELDS].slice(0, 15)).toEqual([
      'collectionReceiptNo',
      'storeName',
      'collectorName',
      'variance',
      'cardTotal',
      'varianceReasonCode',
      'openedAt',
      'closedAt',
      'systemCash',
      'countedCash',
      'openingFloat',
      'countedCashNet',
      'cardTransactionCount',
      'varianceReasonText',
      'zReportIds',
    ])
  })

  it('withholds the document’s ULID, the label’s parts and the figures 335 only declared', () => {
    expect([...NON_COLUMN_FIELDS]).toEqual([
      'collectionReceiptId',
      'hasSurplus',
      'hasTheft',
      'isSettlement',
      'isOffSystem',
      'theftAmount',
      'cashSales',
      'settlement',
      'settlementAdjustmentTotal',
      'settlementEntryNumber',
      'settlementDescription',
      'shiftSettlementAdjustment',
      'shiftSettlementEntryNumber',
      'shiftCardTotal',
      'receiptKind',
      'collectionStatus',
      'offSystemAt',
      'offSystemBy',
      'offSystemReasonCode',
      'offSystemReasonText',
      'zNumber',
      'amendmentCount',
      'lastAmendedBy',
    ])
  })

  it('every money field is one of the row’s own fields', () => {
    for (const field of MONEY_FIELDS) expect(WIRE_FIELDS).toContain(field)
  })
})

describe('buildCollectionsColumns', () => {
  it('shows the default ten with the toggle off', () => {
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
    const column = buildCollectionsColumns(t, [ROW], true).find((c) => c.colId === 'cardTotal')
    const format = column?.valueFormatter as (p: unknown) => string
    // BHD draws three decimals even though the header says whatever it says.
    expect(format({ value: 8310.25, data: { ...ROW, currencyKey: 'BHD' } })).toBe('8,310.250')
    expect(format({ value: 8310.25, data: ROW })).toBe('8,310.25')
  })

  it('leaves a missing figure BLANK rather than 0.00', () => {
    const column = buildCollectionsColumns(t, [ROW], true).find((c) => c.colId === 'variance')
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
      ['businessDay', '2026-08-06'],
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

// Ticket 335 (BackOffice 2149 D1–D3; the wire is BackOffice 2151 + 2152's Web
// contract): the grid opens as finance's sheet.
describe('finance’s sheet', () => {
  /** What a cell shows: the ColDef's own reading of a row, as AG Grid makes it. */
  const shown = (colId: string, row: CollectionInquiryRow, showMore = false): unknown => {
    const column = buildCollectionsColumns(t, [row], showMore).find((c) => c.colId === colId)
    const value =
      typeof column?.valueGetter === 'function'
        ? column.valueGetter({ data: row } as never)
        : row[column?.field as keyof CollectionInquiryRow]
    return typeof column?.valueFormatter === 'function'
      ? column.valueFormatter({ value, data: row } as never)
      : value
  }

  it('default columns are finance’s nine in order, then profit center', () => {
    expect([...DEFAULT_FIELDS]).toEqual([
      'collectedAt',
      'businessDay',
      'storeId',
      'collectionType',
      'description',
      'amount',
      'surplus',
      'netCollected',
      'collectorOperatorId',
      // The raw profit center, after the sheet's nine — the store code is already third.
      'profitCenter',
    ])
    expect(buildCollectionsColumns(t, [ROW], false).map((c) => c.colId)).toEqual([...DEFAULT_FIELDS])
  })

  it('heads each of the ten with its own key', () => {
    expect(buildCollectionsColumns(t, [ROW], false).map((c) => c.headerName)).toEqual([
      'collections.columns.collectedAt',
      'collections.columns.businessDay',
      'collections.columns.storeId',
      'collections.columns.collectionType',
      'collections.columns.description',
      'collections.moneyHeader|{"label":"collections.columns.amount","currency":"SAR"}',
      'collections.moneyHeader|{"label":"collections.columns.surplus","currency":"SAR"}',
      'collections.moneyHeader|{"label":"collections.columns.netCollected","currency":"SAR"}',
      'collections.columns.collectorOperatorId',
      'collections.columns.profitCenter',
    ])
  })

  it('type cell shows the server label for each of the five shapes', () => {
    // The five shapes and the outside-system label, exactly as 2151 lists them.
    for (const label of [
      'Regular',
      'Short',
      'Regular+Surplus',
      'Regular+Stolen',
      'Regular+Surplus+Stolen',
      'Outside system',
    ]) {
      expect(shown('collectionType', { ...ROW, collectionType: label })).toBe(label)
    }
  })

  it('does not derive the type — the parts may disagree with the label and the label wins', () => {
    const column = buildCollectionsColumns(t, [ROW], false).find((c) => c.colId === 'collectionType')
    expect(column?.field).toBe('collectionType')
    expect(column?.valueGetter).toBeUndefined()
    expect(column?.valueFormatter).toBeUndefined()
    // Every part says "a stolen settlement receipt outside the system"; the cell
    // still says what the server said.
    const contrary: CollectionInquiryRow = {
      ...ROW,
      collectionType: 'Regular',
      hasSurplus: true,
      hasTheft: true,
      theftAmount: 3000,
      isSettlement: true,
      isOffSystem: true,
      receiptKind: 'SETTLEMENT',
      collectionStatus: 'OFF_SYSTEM',
    }
    expect(shown('collectionType', contrary)).toBe('Regular')
    // …and a label this build has never heard of is shown, not blanked or mapped.
    expect(shown('collectionType', { ...ROW, collectionType: 'Regular+Refund' })).toBe('Regular+Refund')
  })

  it('shows the surplus as the negative figure sent, and zero as zero', () => {
    expect(shown('surplus', { ...ROW, amount: 2000, surplus: -1000, netCollected: 1000 })).toBe('-1,000.00')
    expect(shown('surplus', { ...ROW, surplus: 0 })).toBe('0.00')
    // Finance's Regular+Stolen sample: 3500 / -3000 / 500.
    const stolen = { ...ROW, collectionType: 'Regular+Stolen', amount: 3500, surplus: -3000, netCollected: 500 }
    expect([shown('amount', stolen), shown('surplus', stolen), shown('netCollected', stolen)]).toEqual([
      '3,500.00',
      '-3,000.00',
      '500.00',
    ])
  })

  it('shows the description as sent, Arabic included, and an empty one blank', () => {
    const column = buildCollectionsColumns(t, [ROW], false).find((c) => c.colId === 'description')
    expect(column?.valueFormatter).toBeUndefined()
    // Copied from BackOffice 2151's sample response — never retyped.
    expect(shown('description', { ...ROW, description: 'مرتجع شبكة 5512' })).toBe('مرتجع شبكة 5512')
    expect(shown('description', ROW)).toBe('')
    // BackOffice 2152: a surplus and a theft on one day — the server joins the two
    // descriptions, and the cell shows the joined text whole.
    const both = 'مرتجع شبكة 5512 | سرقة من الخزنة - بلاغ 5521'
    expect(shown('description', { ...ROW, collectionType: 'Regular+Surplus+Stolen', description: both })).toBe(both)
  })

  it('shows BackOffice 2152’s Regular+Stolen sample as sent, hasSurplus false and all', () => {
    // 2152's sample response, verbatim in its figures: cash sales 500, theft 3000.
    const sample: CollectionInquiryRow = {
      ...ROW,
      systemCash: 3500,
      countedCash: 500,
      variance: -3000,
      netCollected: 500,
      receiptKind: 'SHIFT',
      settlementAdjustmentTotal: 0,
      cashSales: 500,
      settlement: 0,
      theftAmount: 3000,
      hasTheft: true,
      hasSurplus: false,
      collectionType: 'Regular+Stolen',
      amount: 3500,
      surplus: -3000,
      // Copied from BackOffice 2152's sample response — never retyped.
      description: 'سرقة من الخزنة - بلاغ 5521',
    }
    expect(
      ['collectionType', 'description', 'amount', 'surplus', 'netCollected'].map((id) => shown(id, sample)),
    ).toEqual(['Regular+Stolen', 'سرقة من الخزنة - بلاغ 5521', '3,500.00', '-3,000.00', '500.00'])
  })

  it('shows the collector’s id under Collector, and folds the name into the tail', () => {
    expect(shown('collectorOperatorId', ROW)).toBe('4472')
    expect(MORE_FIELDS).toContain('collectorName')
  })

  it('more columns still offers every previous field', () => {
    // The 27 columns the screen had before ticket 335, by field. None may leave.
    const before = [
      'collectionReceiptNo',
      'storeId',
      'storeText',
      'storeName',
      'collectorName',
      'businessDay',
      'collectedAt',
      'netCollected',
      'variance',
      'cardTotal',
      'varianceReasonCode',
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
      'retainedFloat',
      'closerOperatorId',
      'closerName',
      'salesDate',
      'currencyKey',
      'profitCenter',
    ]
    const open = buildCollectionsColumns(t, [ROW], true).map((c) => c.colId)
    for (const field of before) expect(open, field).toContain(field)
    // …each exactly once, and the slip count with them for a session that may see it.
    expect(new Set(open).size).toBe(open.length)
    expect(buildCollectionsColumns(t, [ROW], true, true).map((c) => c.colId)).toContain('slipCount')
    // The tail follows finance's ten; it never reorders them.
    expect(open.slice(0, DEFAULT_FIELDS.length)).toEqual([...DEFAULT_FIELDS])
  })

  it('rows keep the server order by default', () => {
    // The grid shows `rowData` in the order given unless a column says otherwise,
    // so "no default sort" is: no column, with the tail open or folded and the slip
    // count drawn, carries a sort of its own — and neither does the default ColDef.
    const sortKeys = ['sort', 'initialSort', 'sortIndex', 'initialSortIndex'] as const
    for (const showMore of [false, true]) {
      for (const column of buildCollectionsColumns(t, [ROW], showMore, true)) {
        for (const key of sortKeys) expect(column[key], `${column.colId}.${key}`).toBeUndefined()
      }
    }
    for (const showFilters of [false, true]) {
      const defaults = buildCollectionsDefaultColDef(showFilters)
      for (const key of sortKeys) expect(defaults[key]).toBeUndefined()
      // A header click is still the user's to make.
      expect(defaults.sortable).toBe(true)
    }
  })
})

// Ticket 315 (BackOffice 1992): the Business date column reads `businessDay`, the
// date part only, and `null` renders blank — never 0001-01-01.
describe('the Business date column', () => {
  const column = () =>
    buildCollectionsColumns(t, [ROW], false).find((c) => c.colId === 'businessDay')

  it('is on the DEFAULT grid, right after the collection date — no More columns needed', () => {
    const ids = buildCollectionsColumns(t, [ROW], false).map((c) => c.colId)
    expect(ids).toContain('businessDay')
    expect(ids).toContain('collectedAt')
    // Finance's order (ticket 335): the collection date leads, the business date follows.
    expect(ids.indexOf('businessDay')).toBe(ids.indexOf('collectedAt') + 1)
  })

  it('reads businessDay, not salesDate — the contract rules salesDate out', () => {
    expect(column()?.field).toBe('businessDay')
    expect(column()?.headerName).toBe('collections.columns.businessDay')
  })

  it('renders the date part only', () => {
    const format = column()?.valueFormatter as (p: unknown) => string
    expect(format({ value: '2026-09-02T00:00:00', data: ROW })).toBe('2026-09-02')
  })

  it('renders a null business day (a settlement receipt, a pre-049 day) blank', () => {
    const format = column()?.valueFormatter as (p: unknown) => string
    const filter = column()?.filterValueGetter as (p: unknown) => string
    const settlement = { ...ROW, businessDay: null }
    expect(format({ value: null, data: settlement })).toBe('')
    expect(filter({ data: settlement })).toBe('')
    expect(format({ value: '0001-01-01T00:00:00', data: ROW })).toBe('')
  })
})

// The landing grid's Profit Center is the raw `profitCenter` (`PH-019`), as sent:
// the store code is already the third column, so ticket 314's composed `storeText`
// (`PH-019 (P019)`) folds into the tail (owner's call, 2026-10-03).
describe('the profit center column', () => {
  const find = (colId: string, showMore = false) =>
    buildCollectionsColumns(t, [ROW], showMore).find((c) => c.colId === colId)

  it('is on the DEFAULT grid, right after finance’s nine', () => {
    const ids = buildCollectionsColumns(t, [ROW], false).map((c) => c.colId)
    expect(ids.indexOf('profitCenter')).toBe(9)
    expect(ids).toHaveLength(10)
  })

  it('reads the raw profitCenter with a t() header, and no formatter of its own', () => {
    const column = find('profitCenter')
    expect(column?.field).toBe('profitCenter')
    expect(column?.headerName).toBe('collections.columns.profitCenter')
    // 🚩 As sent: no store code appended, nothing composed client-side.
    expect(column?.valueFormatter).toBeUndefined()
    expect(column?.valueGetter).toBeUndefined()
  })

  it('folds the composed storeText into the tail, not onto the landing grid', () => {
    expect(MORE_FIELDS).toContain('storeText')
    expect(buildCollectionsColumns(t, [ROW], false).map((c) => c.colId)).not.toContain('storeText')
    const composed = find('storeText', true)
    expect(composed?.field).toBe('storeText')
    expect(composed?.headerName).toBe('collections.columns.storeText')
    expect(composed?.valueFormatter).toBeUndefined()
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

/**
 * The Slips column (ticket 320, BackOffice 2034). Hidden unless the slip probe
 * admits; each row drawn by its OWN day's count; a null is a dash, never 0.
 */
describe('the Slips column', () => {
  const slipCell = (row: CollectionInquiryRow) => {
    const column = buildCollectionsColumns(t, [row], false, true).find((c) => c.colId === 'slipCount')
    const value = (column?.valueGetter as (p: unknown) => unknown)({ data: row })
    return (column?.valueFormatter as (p: unknown) => string)({ value, data: row })
  }

  it('is hidden unless the probe admits — the default is hidden', () => {
    expect(buildCollectionsColumns(t, [ROW], true).map((c) => c.colId)).not.toContain('slipCount')
    expect(buildCollectionsColumns(t, [ROW], true, false).map((c) => c.colId)).not.toContain('slipCount')
  })

  it('lands right after the card total when admitted', () => {
    const ids = buildCollectionsColumns(t, [ROW], true, true).map((c) => c.colId)
    expect(ids.indexOf('slipCount')).toBe(ids.indexOf('cardTotal') + 1)
    expect(ids.filter((id) => id !== 'slipCount')).toEqual([...DEFAULT_FIELDS, ...MORE_FIELDS])
  })

  it('is the last column while the card total is folded away', () => {
    // Since ticket 335 the card total is behind More columns. The count is still
    // drawn for a session the probe admits: after finance's ten, never among them.
    const ids = buildCollectionsColumns(t, [ROW], false, true).map((c) => c.colId)
    expect(ids).toEqual([...DEFAULT_FIELDS, 'slipCount'])
  })

  it('draws a count as sent, a real 0 as 0, and null as the dash', () => {
    expect(slipCell(ROW)).toBe('2')
    expect(slipCell({ ...ROW, slipCount: 0 })).toBe('0')
    // A settlement row is always null: a dash, never 0.
    expect(slipCell({ ...ROW, businessDay: null, slipCount: null })).toBe('—')
  })

  it('a multi-shift receipt’s rows keep their own day’s counts — never merged or summed', () => {
    const shift1 = { ...ROW, businessDay: '2026-08-05T00:00:00', slipCount: 0 }
    const shift2 = { ...ROW, businessDay: '2026-08-06T00:00:00', slipCount: 3 }
    expect([slipCell(shift1), slipCell(shift2)]).toEqual(['0', '3'])
  })

  it('leaves the existing card total alone — still the receipt’s money column', () => {
    expect(MONEY_FIELDS).toContain('cardTotal')
    expect(MORE_FIELDS).toContain('cardTotal')
  })
})
