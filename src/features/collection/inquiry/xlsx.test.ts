// The Collections Excel export (ticket 336, BackOffice spec 2149 D4): the file is the
// grid as shown. ⚠️ Every rule in here fails **silently** — a receipt number written as
// a number totals in Excel, a money cell written as text sums to zero, a folded column
// that ships anyway is a file that disagrees with the screen — and all of them open
// without complaint.
//
// The grid here is a stand-in (`shownGrid`): the screen's REAL column definitions over a
// fixture, answering the three calls the writer makes as AG Grid answers them. What it
// cannot prove — that the real grid's filter row and header click narrow and order the
// walk — is `tools/collection-drive.mjs`'s, which reads the downloaded workbook back.
//
// 🚩 Every Arabic string below is **copied** from `voucher-fixture.ts` /
// `acr-fixture.ts` — never retyped. A retyped Arabic string looks right and is
// silently wrong, and no gate in this repo catches it.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ColDef, GridApi } from 'ag-grid-community'
import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import type {
  AcrInquiryRow,
  CollectionAttemptRow,
  CollectionInquiryRow,
  DepositInquiryRow,
} from '@/core/models/collection'

import { DEFAULT_FIELDS as ACR_DEFAULT, MORE_FIELDS as ACR_MORE, buildAcrsColumns } from './acr-columns'
import { DEFAULT_FIELDS as ATTEMPTS_DEFAULT, buildAttemptsColumns } from './attempts-columns'
import {
  DEFAULT_FIELDS as COLLECTIONS_DEFAULT,
  MONEY_FIELDS as COLLECTIONS_MONEY,
  MORE_FIELDS as COLLECTIONS_MORE,
  buildCollectionsColumns,
} from './collections-columns'
import { DEFAULT_FIELDS as DEPOSITS_DEFAULT, buildDepositsColumns } from './deposit-columns'
import { buildAcrActionsColumn, buildReceiptActionColumn } from './RowActions'
import { collectionSheet, collectionXlsxFileName, sheetName } from './xlsx'

const t = i18n.getFixedT('en', 'collection')

/**
 * The grid as shown, for the writer: `columns` are the displayed columns in display
 * order and `rows` the rows left after filter and sort, in that order. A cell's value
 * is its `valueGetter` or its `field`, and its text the `valueFormatter` over that —
 * AG Grid's own reading of a ColDef.
 */
function shownGrid<Row>(columns: ColDef<Row>[], rows: Row[]): GridApi<Row> {
  type Shown = { getColDef: () => ColDef<Row>; getColId: () => string; getActualWidth: () => number }
  const shown: Shown[] = columns.map((def) => ({
    getColDef: () => def,
    getColId: () => def.colId ?? String(def.field),
    getActualWidth: () => def.width ?? 200,
  }))
  const api = {
    getAllDisplayedColumns: () => shown,
    forEachNodeAfterFilterAndSort: (visit: (node: { data: Row }) => void) => rows.forEach((data) => visit({ data })),
    getCellValue: ({ rowNode, colKey, useFormatter }: { rowNode: { data: Row }; colKey: Shown; useFormatter?: boolean }) => {
      const def = colKey.getColDef()
      const data = rowNode.data
      const value =
        typeof def.valueGetter === 'function'
          ? def.valueGetter({ data } as never)
          : (data as Record<string, unknown>)[String(def.field)]
      return useFormatter && typeof def.valueFormatter === 'function'
        ? def.valueFormatter({ value, data } as never)
        : value
    },
  }
  return api as unknown as GridApi<Row>
}

const collection = (over: Partial<CollectionInquiryRow> = {}): CollectionInquiryRow => ({
  collectionReceiptId: '01J0COLLECT0000000000000',
  collectionReceiptNo: 91000,
  storeId: '0104',
  // Copied from `acr-fixture.ts` — never retyped.
  storeName: 'محمد عبدالله الشهري',
  profitCenter: 'PH-0104',
  storeText: 'PH-0104 (0104)',
  collectorOperatorId: '030417',
  // Copied from `voucher-fixture.ts` — never retyped.
  collectorName: 'عبدالله بن ناصر القحطاني',
  closerOperatorId: '81265',
  // Copied from `voucher-fixture.ts` — never retyped.
  closerName: 'محمد سمير الحلبي',
  openedAt: '2026-08-06T07:00:00',
  closedAt: '2026-08-06T15:04:00',
  collectedAt: '2026-08-06T21:14:33',
  businessDay: '2026-08-06T00:00:00',
  salesDate: '2026-08-06T00:00:00',
  systemCash: 12480.5,
  countedCash: 12475,
  variance: -5.5,
  varianceReasonCode: 'SHORT',
  varianceReasonText: 'Counted short at close',
  openingFloat: 500,
  countedCashNet: 11975,
  retainedFloat: 500,
  netCollected: 1234567.89,
  cardTotal: 8310.25,
  cardTransactionCount: 96,
  zReportIds: 'Z-88121',
  currencyKey: 'SAR',
  slipCount: 2,
  // BackOffice 2151's third sample shape: a day with a surplus deduction.
  collectionType: 'Regular+Surplus',
  hasSurplus: true,
  hasTheft: false,
  theftAmount: 0,
  amount: 1235567.89,
  surplus: -1000,
  // Copied from BackOffice 2151's sample response — never retyped.
  description: 'مرتجع شبكة 5512',
  cashSales: 1235567.89,
  settlement: -1000,
  settlementAdjustmentTotal: 1000,
  settlementEntryNumber: 1412,
  settlementDescription: 'مرتجع شبكة 5512',
  shiftSettlementAdjustment: 1000,
  shiftSettlementEntryNumber: 1412,
  shiftCardTotal: 8310.25,
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
  ...over,
})

const acr = (over: Partial<AcrInquiryRow> = {}): AcrInquiryRow => ({
  acrId: '01J0ACR00000000000000000',
  acrNumber: 40,
  label: 'Riyadh run 40',
  collectorOperatorId: '30417',
  collectorName: 'عبدالله بن ناصر القحطاني',
  acrDate: '2026-08-06T00:00:00',
  status: 'OPEN',
  firstCollectedAt: '2026-08-05T10:15:00',
  lastCollectedAt: '2026-08-06T15:40:00',
  createdAt: '2026-08-06T08:15:00',
  closedAt: '0001-01-01T00:00:00',
  closedBy: '',
  closedByName: '',
  linkedCollectionCount: 12,
  cashSalesTotal: 143610.75,
  settlementTotal: -200,
  bankedTotal: 143410.75,
  cardTotalSum: 99120.5,
  cardTransactionCountSum: 812,
  depositId: '',
  depositNumber: 0,
  depositStatus: '',
  ...over,
})

const deposit = (over: Partial<DepositInquiryRow> = {}): DepositInquiryRow => ({
  depositId: '01J0DEPOSIT000000000000',
  depositNumber: 5500,
  collectorOperatorId: '30417',
  collectorName: 'عبدالله بن ناصر القحطاني',
  bankCode: '0055',
  bankName: 'Al Rajhi Bank',
  status: 'POSTED',
  depositedAt: '2026-08-06T11:20:00',
  createdAt: '2026-08-06T11:22:00',
  calculatedAmount: 143910.75,
  realAmount: 143510.75,
  diffAmount: -400,
  reasonCode: 'SHORT',
  noteText: '',
  voidedBy: '',
  voidedAt: '0001-01-01T00:00:00',
  voidReason: '',
  lines: [],
  attachments: [],
  ...over,
})

const attempt = (over: Partial<CollectionAttemptRow> = {}): CollectionAttemptRow => ({
  attemptId: '01J0ATTEMPT00000000000',
  collectorStaffId: '30417',
  collectorName: 'عبدالله بن ناصر القحطاني',
  storeCode: '0104',
  storeName: 'محمد عبدالله الشهري',
  // No profit center recorded: the server's storeText is the code alone.
  profitCenter: '',
  storeText: '0104',
  shiftId: '01J0SHIFT000000000000',
  businessDay: '2026-08-06T00:00:00',
  attemptTime: '2026-08-06T09:12:00',
  reasonCode: 'STORE_CLOSED',
  reasonText: 'Branch shut for maintenance',
  ...over,
})

/** Cash Collections exactly as its Page composes it: the actions column, then the fields. */
const collectionsGrid = (rows: CollectionInquiryRow[], showMore: boolean, showSlips = false) =>
  shownGrid([buildReceiptActionColumn(t), ...buildCollectionsColumns(t, rows, showMore, showSlips)], rows)

const acrsGrid = (rows: AcrInquiryRow[], showMore: boolean) =>
  shownGrid([buildAcrActionsColumn(t, true), ...buildAcrsColumns(t, showMore)], rows)

type Sheet = ReturnType<typeof collectionSheet>
const headers = (sheet: Sheet): unknown[] => sheet.data[0].map((cell) => (cell as { value: unknown }).value)
/** The body cell under `header`, in data row `row` (0 is the first row under the header). */
const cellUnder = (sheet: Sheet, header: string, row = 0): unknown => {
  const at = headers(sheet).indexOf(header)
  expect(at, `the sheet has a "${header}" column`).toBeGreaterThanOrEqual(0)
  return sheet.data[row + 1][at]
}
const label = (section: string, field: string): string => t(`${section}.columns.${field}`)
/** A money column's header on a one-currency result — the grid's own `Net Collected (SAR)`. */
const moneyLabel = (field: string): string =>
  t('collections.moneyHeader', { label: label('collections', field), currency: 'SAR' })
const collectionsHeader = (field: string): string =>
  (COLLECTIONS_MONEY as readonly string[]).includes(field) ? moneyLabel(field) : label('collections', field)

describe('cash collections export writes the visible columns in grid order', () => {
  it('writes the default columns, in the grid’s order, with More columns off', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], false), 'collections', 'Cash Collections')
    expect(headers(sheet)).toEqual(COLLECTIONS_DEFAULT.map(collectionsHeader))
  })

  it('leaves the folded columns OUT while the toggle is off — the file follows the toggle', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], false), 'collections', 'Cash Collections')
    for (const field of COLLECTIONS_MORE) expect(headers(sheet)).not.toContain(collectionsHeader(field))
  })

  it('writes the folded columns after the defaults once More columns is on', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], true), 'collections', 'Cash Collections')
    expect(headers(sheet)).toEqual([...COLLECTIONS_DEFAULT, ...COLLECTIONS_MORE].map(collectionsHeader))
  })

  it('never writes the actions column: it holds links, not a value', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], true), 'collections', 'Cash Collections')
    expect(headers(sheet)).not.toContain(t('collections.actions.header'))
    expect(sheet.data[1]).toHaveLength(COLLECTIONS_DEFAULT.length + COLLECTIONS_MORE.length)
    expect(sheet.columns).toHaveLength(sheet.data[0].length)
  })

  it('writes the slip count where the grid shows it, and not where it does not', () => {
    // The card total is behind More columns since ticket 335; the count follows it there.
    const shown = collectionSheet(collectionsGrid([collection()], true, true), 'collections', 'Cash Collections')
    expect(headers(shown).indexOf(t('slips.column'))).toBe(headers(shown).indexOf(moneyLabel('cardTotal')) + 1)
    expect(cellUnder(shown, t('slips.column'))).toEqual({ type: Number, value: 2 })

    const hidden = collectionSheet(collectionsGrid([collection()], false, false), 'collections', 'Cash Collections')
    expect(headers(hidden)).not.toContain(t('slips.column'))
  })

  it('writes the rows the grid walks, in the grid’s order, under a bold header', () => {
    const rows = [collection({ collectionReceiptNo: 3 }), collection({ collectionReceiptNo: 1 })]
    const sheet = collectionSheet(collectionsGrid(rows, true), 'collections', 'Cash Collections')
    expect(sheet.name).toBe('Cash Collections')
    expect(sheet.count).toBe(2)
    expect(sheet.data[0].every((cell) => (cell as { fontWeight?: string }).fontWeight === 'bold')).toBe(true)
    expect([cellUnder(sheet, label('collections', 'collectionReceiptNo'), 0), cellUnder(sheet, label('collections', 'collectionReceiptNo'), 1)]).toEqual([
      { type: String, value: '3' },
      { type: String, value: '1' },
    ])
  })

  it('keeps the dates in the screen’s format', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], false), 'collections', 'Cash Collections')
    expect(cellUnder(sheet, label('collections', 'businessDay'))).toEqual({ type: String, value: '2026-08-06' })
    expect(cellUnder(sheet, label('collections', 'collectedAt'))).toEqual({ type: String, value: '2026-08-06 21:14' })
  })
})

describe('export keeps an Arabic description intact', () => {
  it('writes Arabic free text and names exactly as the row carries them', () => {
    // The accountant's free text on this grid is the variance reason detail.
    const arabic = 'محمد سمير الحلبي'
    const sheet = collectionSheet(
      collectionsGrid([collection({ varianceReasonText: arabic })], true),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(sheet, label('collections', 'varianceReasonText'))).toEqual({ type: String, value: arabic })
    expect(cellUnder(sheet, label('collections', 'storeName'))).toEqual({ type: String, value: 'محمد عبدالله الشهري' })
    expect(cellUnder(sheet, label('collections', 'collectorName'))).toEqual({
      type: String,
      value: 'عبدالله بن ناصر القحطاني',
    })
  })

  it('writes the settlement entry’s description, on the default grid, as the row carries it', () => {
    // Ticket 335's Description column: finance's fifth, so it is in the file with
    // More columns off.
    const sheet = collectionSheet(collectionsGrid([collection()], false), 'collections', 'Cash Collections')
    expect(cellUnder(sheet, label('collections', 'description'))).toEqual({ type: String, value: 'مرتجع شبكة 5512' })
  })

  it('writes finance’s type as the text the server sent', () => {
    const sheet = collectionSheet(collectionsGrid([collection()], false), 'collections', 'Cash Collections')
    expect(cellUnder(sheet, label('collections', 'collectionType'))).toEqual({ type: String, value: 'Regular+Surplus' })
  })

  it('writes text that opens like a formula as text, never as a formula', () => {
    const sheet = collectionSheet(
      collectionsGrid([collection({ varianceReasonText: '=cmd|calc' })], true),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(sheet, label('collections', 'varianceReasonText'))).toEqual({ type: String, value: '=cmd|calc' })
  })
})

describe('money is numeric and store codes are text in the sheet', () => {
  const sheet = collectionSheet(collectionsGrid([collection()], true), 'collections', 'Cash Collections')

  it('writes every money column as a bare number — no grouping, no symbol', () => {
    const row = collection()
    for (const field of COLLECTIONS_MONEY)
      expect(cellUnder(sheet, moneyLabel(field)), field).toEqual({ type: Number, value: row[field] })
    expect(cellUnder(sheet, moneyLabel('netCollected'))).toEqual({ type: Number, value: 1234567.89 })
  })

  it('keeps a shortfall’s minus as part of the number', () => {
    expect(cellUnder(sheet, moneyLabel('variance'))).toEqual({ type: Number, value: -5.5 })
  })

  it('writes finance’s surplus as the negative number sent, and a zero one as the number 0', () => {
    expect(cellUnder(sheet, moneyLabel('surplus'))).toEqual({ type: Number, value: -1000 })
    const regular = collectionSheet(
      collectionsGrid([collection({ collectionType: 'Regular', surplus: 0 })], false),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(regular, moneyLabel('surplus'))).toEqual({ type: Number, value: 0 })
  })

  it('writes a missing amount as an empty cell, never as a zero that would be summed', () => {
    const blank = collectionSheet(
      collectionsGrid([collection({ variance: null as never })], true),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(blank, moneyLabel('variance'))).toEqual({ type: String, value: '' })
  })

  it('writes a count as a number too', () => {
    expect(cellUnder(sheet, label('collections', 'cardTransactionCount'))).toEqual({ type: Number, value: 96 })
  })

  it('writes the store code and the ids as text, so a leading zero survives', () => {
    expect(cellUnder(sheet, label('collections', 'storeId'))).toEqual({ type: String, value: '0104' })
    expect(cellUnder(sheet, label('collections', 'storeText'))).toEqual({ type: String, value: 'PH-0104 (0104)' })
    expect(cellUnder(sheet, label('collections', 'collectorOperatorId'))).toEqual({ type: String, value: '030417' })
  })

  it('writes the receipt number as text although the wire sends a number', () => {
    const long = collectionSheet(
      collectionsGrid([collection({ collectionReceiptNo: 123456789012 })], true),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(long, label('collections', 'collectionReceiptNo'))).toEqual({ type: String, value: '123456789012' })
  })
})

describe('acr, attempts and deposits export through the same writer', () => {
  it('ACRs: the shown columns in order, the derived collection date included, the actions left out', () => {
    const sheet = collectionSheet(acrsGrid([acr()], false), 'acrs', 'ACRs')
    const expected = ACR_DEFAULT.flatMap((field) =>
      field === 'acrDate' ? [label('acrs', field), label('acrs', 'collectionDate')] : [label('acrs', field)],
    )
    expect(headers(sheet)).toEqual(expected)
    expect(cellUnder(sheet, label('acrs', 'collectionDate'))).toEqual({
      type: String,
      value: '2026-08-05 – 2026-08-06',
    })
    for (const field of ACR_MORE) expect(headers(sheet)).not.toContain(label('acrs', field))
  })

  it('ACRs: the four figures and the two counts are numbers, settlement signed as sent', () => {
    const sheet = collectionSheet(acrsGrid([acr()], false), 'acrs', 'ACRs')
    expect(cellUnder(sheet, label('acrs', 'cashSalesTotal'))).toEqual({ type: Number, value: 143610.75 })
    expect(cellUnder(sheet, label('acrs', 'settlementTotal'))).toEqual({ type: Number, value: -200 })
    expect(cellUnder(sheet, label('acrs', 'bankedTotal'))).toEqual({ type: Number, value: 143410.75 })
    expect(cellUnder(sheet, label('acrs', 'cardTotalSum'))).toEqual({ type: Number, value: 99120.5 })
    expect(cellUnder(sheet, label('acrs', 'linkedCollectionCount'))).toEqual({ type: Number, value: 12 })
    expect(cellUnder(sheet, label('acrs', 'cardTransactionCountSum'))).toEqual({ type: Number, value: 812 })
  })

  it('ACRs: the ACR number is text, and an unbanked ACR has a blank deposit number, not a 0', () => {
    const sheet = collectionSheet(acrsGrid([acr()], true), 'acrs', 'ACRs')
    expect(cellUnder(sheet, label('acrs', 'acrNumber'))).toEqual({ type: String, value: '40' })
    expect(cellUnder(sheet, label('acrs', 'depositNumber'))).toEqual({ type: String, value: '' })
    // Still open: the year-1 sentinel reads blank, as on screen.
    expect(cellUnder(sheet, label('acrs', 'closedAt'))).toEqual({ type: String, value: '' })
  })

  it('ACRs: a swept ACR reads as the screen’s sentence — the file is the grid as shown', () => {
    const sheet = collectionSheet(acrsGrid([acr({ closedBy: 'SYSTEM', closedByName: 'SYSTEM' })], false), 'acrs', 'ACRs')
    expect(cellUnder(sheet, label('acrs', 'closedByName'))).toEqual({ type: String, value: t('acrs.closedBy.system') })
  })

  it('deposits: the shown columns in order, money as numbers, the deposit number and bank code as text', () => {
    const closed = shownGrid(buildDepositsColumns(t, false), [deposit()])
    const sheet = collectionSheet(closed, 'deposits', 'Deposits')
    const expected = DEPOSITS_DEFAULT.flatMap((field) =>
      field === 'depositedAt' ? [label('deposits', 'businessDate'), label('deposits', field)] : [label('deposits', field)],
    )
    expect(headers(sheet)).toEqual(expected)
    expect(cellUnder(sheet, label('deposits', 'depositNumber'))).toEqual({ type: String, value: '5500' })
    expect(cellUnder(sheet, label('deposits', 'calculatedAmount'))).toEqual({ type: Number, value: 143910.75 })
    expect(cellUnder(sheet, label('deposits', 'realAmount'))).toEqual({ type: Number, value: 143510.75 })
    expect(cellUnder(sheet, label('deposits', 'diffAmount'))).toEqual({ type: Number, value: -400 })
    expect(cellUnder(sheet, label('deposits', 'depositedAt'))).toEqual({ type: String, value: '2026-08-06 11:20' })

    const open = collectionSheet(shownGrid(buildDepositsColumns(t, true), [deposit()]), 'deposits', 'Deposits')
    expect(cellUnder(open, label('deposits', 'bankCode'))).toEqual({ type: String, value: '0055' })
  })

  it('attempts: the shown columns in order, and not one numeric cell — an attempt collected nothing', () => {
    const sheet = collectionSheet(shownGrid(buildAttemptsColumns(t, true), [attempt()]), 'attempts', 'Collection Attempts')
    expect(headers(sheet).slice(0, ATTEMPTS_DEFAULT.length)).toEqual(ATTEMPTS_DEFAULT.map((f) => label('attempts', f)))
    expect(cellUnder(sheet, label('attempts', 'storeCode'))).toEqual({ type: String, value: '0104' })
    expect(cellUnder(sheet, label('attempts', 'storeName'))).toEqual({ type: String, value: 'محمد عبدالله الشهري' })
    expect(sheet.data[1].every((cell) => (cell as { type: unknown }).type === String)).toBe(true)
  })

  it('writes an unknown slip count as the dash the cell shows, never as a 0', () => {
    const sheet = collectionSheet(
      collectionsGrid([collection({ slipCount: null })], false, true),
      'collections',
      'Cash Collections',
    )
    expect(cellUnder(sheet, t('slips.column'))).toEqual({ type: String, value: '—' })
  })

  it('names the sheet within the rules Excel sets, whatever the title is', () => {
    expect(sheetName('Cash Collections')).toBe('Cash Collections')
    expect(sheetName('A/B: [C]?*')).toBe('A B   C')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
  })

  it('names each file for its screen and the day, as before, with the workbook extension', () => {
    const day = new Date(2026, 7, 8, 23, 59)
    expect(collectionXlsxFileName('collections', day)).toBe('collection-collections-2026-08-08.xlsx')
    expect(collectionXlsxFileName('acrs', day)).toBe('collection-acrs-2026-08-08.xlsx')
    expect(collectionXlsxFileName('deposits', day)).toBe('collection-deposits-2026-08-08.xlsx')
    expect(collectionXlsxFileName('attempts', day)).toBe('collection-attempts-2026-08-08.xlsx')
  })
})

describe('no collection screen still calls the csv writer', () => {
  const SCREENS = ['CashCollectionsPage.tsx', 'AcrsPage.tsx', 'DepositsPage.tsx', 'CollectionAttemptsPage.tsx']
  const source = (file: string): string => readFileSync(join(__dirname, file), 'utf8')

  /** Any way back to the retired writer: its module, its hook, its entry points, AG Grid's own. */
  const CSV_WRITER =
    /from '\.\/csv'|use-csv-export|useCsvExport|exportGridToCsv|buildCollectionCsv|downloadCsv|exportDataAsCsv/

  it.each(SCREENS)('%s exports through the workbook hook and reaches no csv writer', (file) => {
    expect(source(file)).toContain("from './use-xlsx-export'")
    expect(source(file)).not.toMatch(CSV_WRITER)
  })

  it('the hook and the sheet builder write through the shared grid writer alone', () => {
    expect(source('xlsx.ts')).toContain("from '@/core/util/grid-xlsx'")
    for (const file of ['use-xlsx-export.ts', 'xlsx.ts']) expect(source(file)).not.toMatch(CSV_WRITER)
  })

  it('the collection CSV writer and its hook are gone', () => {
    for (const file of ['csv.ts', 'use-csv-export.ts']) expect(existsSync(join(__dirname, file)), file).toBe(false)
  })
})
