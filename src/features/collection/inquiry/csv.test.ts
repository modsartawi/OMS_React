// The Collections CSV writer (ticket 258, spec 249 "the export writes a summable
// file"). ⚠️ Every guard in here fails **silently**: a wrapped money column sums to
// zero, an unwrapped receipt number loses a leading zero, a BOM-less file turns an
// Arabic pharmacist into mojibake — and all three look completely fine until an
// accountant's reconciliation is out by a column. This is the suite that carries
// the slice's regression risk, which is why the slice is a pure writer at all.
//
// The header resolver is backed by the REAL `collection` locale file rather than a
// stub map, so "the file's headers are the screen's headers" is an assertion and
// not a comment: a missing key surfaces here as a raw key in a cell.
//
// 🚩 Every Arabic string below is **copied** from `voucher-fixture.ts` /
// `acr-fixture.ts` — never retyped. A retyped Arabic string looks right and is
// silently wrong, and no gate in this repo catches it.
import { describe, expect, it } from 'vitest'

import type {
  AcrInquiryRow,
  CollectionAttemptRow,
  CollectionInquiryRow,
  DepositInquiryRow,
} from '@/core/models/collection'
import en from '@/locales/en/collection.json'

import { DEFAULT_FIELDS as ACR_DEFAULT, MORE_FIELDS as ACR_MORE } from './acr-columns'
import { DEFAULT_FIELDS as ATTEMPTS_DEFAULT, MORE_FIELDS as ATTEMPTS_MORE } from './attempts-columns'
import {
  DEFAULT_FIELDS as COLLECTIONS_DEFAULT,
  MORE_FIELDS as COLLECTIONS_MORE,
} from './collections-columns'
import { DEFAULT_FIELDS as DEPOSITS_DEFAULT, MORE_FIELDS as DEPOSITS_MORE } from './deposit-columns'
import {
  ACRS_CSV_COLUMNS,
  ATTEMPTS_CSV_COLUMNS,
  COLLECTIONS_CSV_COLUMNS,
  DEPOSITS_CSV_COLUMNS,
  buildCollectionCsv,
  collectionCsvFileName,
  type CsvColumn,
} from './csv'

/** i18next-shaped lookup over the real namespace — `a.b.c` walks the object. */
const label = (prefix: string) => (field: string) => {
  const hit = `${prefix}.${field}`.split('.').reduce<unknown>((node, part) => {
    return node !== null && typeof node === 'object'
      ? (node as Record<string, unknown>)[part]
      : undefined
  }, en)
  return typeof hit === 'string' ? hit : `${prefix}.${field}`
}

const collectionsHeader = label('collections.columns')
const acrsHeader = label('acrs.columns')
const depositsHeader = label('deposits.columns')
const attemptsHeader = label('attempts.columns')

const BOM = '﻿'

/** The whole file, minus the BOM, split into lines. */
const lines = (csv: string): string[] => csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')
/** The header row — line 2, after the `sep=,` preamble. */
const headerCells = (csv: string): string[] => lines(csv)[1].split(',')
/** The data rows, with the preamble and the header stripped off. */
const bodyLines = (csv: string): string[] => lines(csv).slice(2)

/**
 * Split a data row into its cells, respecting quoting — a comma inside a quoted
 * field is not a separator. The cells come back **as written**, quotes and all,
 * because what these tests assert is the escaping itself.
 *
 * 🚩 `tools/collection-drive.mjs` carries the same parser. Deliberately copied
 * rather than shared: one runs in vitest against the writer, the other in node
 * against bytes Chromium downloaded, and a reader the writer's own suite imported
 * from the code under test would prove nothing.
 */
function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && quoted && line[i + 1] === '"') {
      current += '""'
      i++
    } else if (ch === '"') {
      quoted = !quoted
      current += ch
    } else if (ch === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

/**
 * One column's cell out of a single-row file, by field name, **as Excel reads
 * it** — the RFC-4180 quoting undone, so `"=""0104"""` on the wire is the `="0104"`
 * that lands in the cell. That is the layer these assertions are about: the
 * transport quoting is `escape`'s business and is asserted separately, by the
 * comma and newline cases.
 */
function cellOf<Row>(
  csv: string,
  columns: readonly CsvColumn<Row>[],
  field: keyof Row & string,
): string {
  const cells = splitRow(bodyLines(csv)[0])
  const raw = cells[columns.findIndex((c) => c.field === field)] ?? ''
  return raw.startsWith('"') && raw.endsWith('"') && raw.length > 1
    ? raw.slice(1, -1).replace(/""/g, '"')
    : raw
}

const collection = (over: Partial<CollectionInquiryRow> = {}): CollectionInquiryRow => ({
  collectionReceiptId: '01J0COLLECT0000000000000',
  collectionReceiptNo: 91000,
  storeId: '1042',
  // Copied from `acr-fixture.ts` — never retyped.
  storeName: 'محمد عبدالله الشهري',
  collectorOperatorId: '30417',
  // Copied from `voucher-fixture.ts` — never retyped.
  collectorName: 'عبدالله بن ناصر القحطاني',
  closerOperatorId: '81265',
  // Copied from `voucher-fixture.ts` — never retyped.
  closerName: 'محمد سمير الحلبي',
  openedAt: '2026-08-06T07:00:00',
  closedAt: '2026-08-06T15:04:00',
  collectedAt: '2026-08-06T21:14:33',
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
  createdAt: '2026-08-06T08:15:00',
  closedAt: '0001-01-01T00:00:00',
  linkedCollectionCount: 12,
  netCollectedTotal: 143910.75,
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
  shiftId: '01J0SHIFT000000000000',
  businessDay: '2026-08-06T00:00:00',
  attemptTime: '2026-08-06T09:12:00',
  reasonCode: 'STORE_CLOSED',
  reasonText: 'Branch shut for maintenance',
  ...over,
})

const write = (rows: CollectionInquiryRow[]) =>
  buildCollectionCsv(rows, COLLECTIONS_CSV_COLUMNS, collectionsHeader)

describe('the money rule — bare, and therefore summable', () => {
  it('writes an amount as a plain number: no separator, no symbol, no wrapper', () => {
    const csv = write([collection({ netCollected: 1234567.89 })])
    // ⚠️ THE assertion of the whole slice. `="1,234,567.89"` would look right in a
    // spreadsheet and make `SUM` over the column silently read zero.
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'netCollected')).toBe('1234567.89')
  })

  it('writes a negative amount with its minus, still bare', () => {
    // The LTR-island rule that governs a negative figure ON SCREEN is a rendering
    // rule; in a file a minus sign is simply part of the number.
    expect(cellOf(write([collection({ variance: -5.5 })]), COLLECTIONS_CSV_COLUMNS, 'variance')).toBe(
      '-5.5',
    )
  })

  it('writes a real zero as 0, and a missing amount as an empty cell', () => {
    expect(cellOf(write([collection({ variance: 0 })]), COLLECTIONS_CSV_COLUMNS, 'variance')).toBe('0')
    // `null` reaches the client on a nullable amount; a `0` written where the
    // server sent nothing would be summed as a fact.
    const missing = collection({ variance: null as unknown as number })
    expect(cellOf(write([missing]), COLLECTIONS_CSV_COLUMNS, 'variance')).toBe('')
  })

  it('never wraps ANY money column, on any of the four screens', () => {
    // 🚩 Asserted on the DECODED cell, not by scanning the raw file for `="`. The
    // writer emits the RFC-4180 form `"=""1234.5"""`, so a substring search for
    // the bare `="1` can never fire — this guard is the slice's headline
    // regression check and a vacuous one would let a money field mis-declared as
    // `identity` ship green, with `SUM` silently reading zero.
    const summable = /^(-?\d+(\.\d+)?)?$/
    const check = <Row>(
      rows: Row[],
      columns: readonly CsvColumn<Row>[],
      header: (field: string) => string,
    ) => {
      const csv = buildCollectionCsv(rows, columns, header)
      const money = columns.filter((c) => c.kind === 'money')
      expect(money.length).toBeGreaterThan(0)
      for (const column of money) {
        const cell = cellOf(csv, columns, column.field)
        expect(cell, `${column.field} must be bare and summable`).toMatch(summable)
      }
    }
    check([collection()], COLLECTIONS_CSV_COLUMNS, collectionsHeader)
    check([acr()], ACRS_CSV_COLUMNS, acrsHeader)
    check([deposit()], DEPOSITS_CSV_COLUMNS, depositsHeader)
  })

  it('and the guard above really does catch a money column declared as identity', () => {
    // The guard's own guard: a deliberately mis-declared column, run through the
    // real writer, must come out looking nothing like a summable number.
    const wrong = [{ field: 'netCollected', kind: 'identity' }] as const
    const csv = buildCollectionCsv([collection()], wrong, collectionsHeader)
    expect(cellOf(csv, wrong, 'netCollected')).toBe('="1234567.89"')
    expect(cellOf(csv, wrong, 'netCollected')).not.toMatch(/^(-?\d+(\.\d+)?)?$/)
  })
})

describe('the identity rule — wrapped, and therefore unmangled', () => {
  it('keeps a store code with a leading zero', () => {
    const csv = buildCollectionCsv([attempt({ storeCode: '0104' })], ATTEMPTS_CSV_COLUMNS, attemptsHeader)
    // ⚠️ Plain quoting would NOT save it: Excel parses `"0104"` as the number 104.
    expect(cellOf(csv, ATTEMPTS_CSV_COLUMNS, 'storeCode')).toBe('="0104"')
  })

  it('keeps a long receipt number out of scientific notation', () => {
    const csv = write([collection({ collectionReceiptNo: 123456789012 })])
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'collectionReceiptNo')).toBe('="123456789012"')
  })

  it('wraps the ACR number the reconciliation workbook keys on', () => {
    const csv = buildCollectionCsv([acr({ acrNumber: 40 })], ACRS_CSV_COLUMNS, acrsHeader)
    expect(cellOf(csv, ACRS_CSV_COLUMNS, 'acrNumber')).toBe('="40"')
  })

  it('blanks an identity that is the number zero, rather than claiming a record', () => {
    // `depositNumber` is 0 until an ACR is banked. A `0` under **Deposit No#** in a
    // workbook reads as the deposit numbered zero — the misreading the ACR grid
    // blanks it to avoid.
    const csv = buildCollectionCsv([acr({ depositNumber: 0 })], ACRS_CSV_COLUMNS, acrsHeader)
    expect(cellOf(csv, ACRS_CSV_COLUMNS, 'depositNumber')).toBe('')
    expect(
      cellOf(
        buildCollectionCsv([acr({ depositNumber: 5500 })], ACRS_CSV_COLUMNS, acrsHeader),
        ACRS_CSV_COLUMNS,
        'depositNumber',
      ),
    ).toBe('="5500"')
  })
})

describe('the free-text rule — inert, and one row', () => {
  it('defuses a note that begins with an =, so it cannot execute on open', () => {
    const csv = write([collection({ varianceReasonText: '=cmd|calc' })])
    // The apostrophe is what Excel eats on display; without it the cell is a
    // formula whatever the quoting.
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'varianceReasonText')).toBe("'=cmd|calc")
  })

  it('defuses the other three formula leads too', () => {
    for (const lead of ['+', '-', '@']) {
      const csv = write([collection({ varianceReasonText: `${lead}SUM(A1)` })])
      expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'varianceReasonText')).toBe(`'${lead}SUM(A1)`)
    }
  })

  it('keeps a value containing a comma in ONE cell', () => {
    const csv = write([collection({ storeName: 'Al Dawaa, Riyadh' })])
    // Quoted on the wire — and therefore ONE cell holding the whole name, rather
    // than a name split across two columns and a row one column wide.
    expect(csv).toContain('"Al Dawaa, Riyadh"')
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'storeName')).toBe('Al Dawaa, Riyadh')
    expect(splitRow(bodyLines(csv)[0])).toHaveLength(COLLECTIONS_CSV_COLUMNS.length)
    expect(bodyLines(csv)).toHaveLength(1)
  })

  it('keeps a value containing a newline in ONE row', () => {
    const csv = write([collection({ varianceReasonText: 'counted short\r\nrecounted' })])
    // 🚩 `bodyLines` splits on CRLF, so this is the assertion that a quoted newline
    // does not become a second row: the file has one data row, and it is the one
    // that opens with the quote.
    expect(csv).toContain('"counted short\r\nrecounted"')
    expect(write([collection()]).split('\r\n')).toHaveLength(4)
    expect(csv.split('\r\n')).toHaveLength(5)
  })
})

describe('Arabic round-trips intact', () => {
  it('carries the store, collector and pharmacist names verbatim', () => {
    const csv = write([collection()])
    expect(csv).toContain('محمد عبدالله الشهري')
    expect(csv).toContain('عبدالله بن ناصر القحطاني')
    expect(csv).toContain('محمد سمير الحلبي')
  })

  it('opens with the BOM, then the sep line — which is what stops the mojibake', () => {
    const csv = write([collection()])
    // The BOM tells Excel the bytes are UTF-8; without it an Arabic name is
    // mojibake on a double-click. `sep=,` is because Excel's double-click path uses
    // the OS list separator — `;` in an Arabic locale — not the comma.
    expect(csv.startsWith(`${BOM}sep=,\r\n`)).toBe(true)
  })

  it('leaves an Arabic note that mixes in Latin unquoted and unescaped', () => {
    // Copied from `acr-fixture.ts` — a real note carrying a Latin `Z` mid-string.
    const csv = write([collection({ varianceReasonText: 'تقرير Z غير مُرحّل' })])
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'varianceReasonText')).toBe('تقرير Z غير مُرحّل')
  })
})

describe('dates are ISO text, so they sort', () => {
  it('writes a datetime as the raw wire value, seconds and all', () => {
    const csv = write([collection({ collectedAt: '2026-08-06T21:14:33' })])
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'collectedAt')).toBe('2026-08-06T21:14:33')
  })

  it('writes a day-only field as yyyy-MM-dd', () => {
    const csv = write([collection({ salesDate: '2026-08-06T00:00:00' })])
    expect(cellOf(csv, COLLECTIONS_CSV_COLUMNS, 'salesDate')).toBe('2026-08-06')
  })

  it('blanks the .NET 0001-01-01 sentinel rather than writing a year-1 date', () => {
    // An ACR still OPEN, and a deposit that was never voided: the sentinel is an
    // ABSENCE on both rows, and a literal `0001-01-01` in a workbook reads as data.
    const open = buildCollectionCsv([acr({ closedAt: '0001-01-01T00:00:00' })], ACRS_CSV_COLUMNS, acrsHeader)
    expect(cellOf(open, ACRS_CSV_COLUMNS, 'closedAt')).toBe('')
    const live = buildCollectionCsv([deposit()], DEPOSITS_CSV_COLUMNS, depositsHeader)
    expect(cellOf(live, DEPOSITS_CSV_COLUMNS, 'voidedAt')).toBe('')
  })
})

describe('every column ships, regardless of the More-columns toggle', () => {
  // 🚩 The file is the row unpacked, not the grid screenshotted. Each of these
  // asserts the file's columns are the UNION of the screen's two field groups —
  // the same union `<screen>-columns.test.ts` proves accounts for the whole wire
  // row — so a folded column is in the file even when the toggle is off.
  const cases = [
    ['collections', COLLECTIONS_CSV_COLUMNS, [...COLLECTIONS_DEFAULT, ...COLLECTIONS_MORE]],
    ['acrs', ACRS_CSV_COLUMNS, [...ACR_DEFAULT, ...ACR_MORE]],
    ['deposits', DEPOSITS_CSV_COLUMNS, [...DEPOSITS_DEFAULT, ...DEPOSITS_MORE]],
    ['attempts', ATTEMPTS_CSV_COLUMNS, [...ATTEMPTS_DEFAULT, ...ATTEMPTS_MORE]],
  ] as const

  for (const [screen, columns, fields] of cases) {
    it(`${screen} — the file's columns are the default group PLUS the forensic tail`, () => {
      expect(columns.map((c) => c.field)).toEqual(fields)
    })
  }

  it('the header row has one cell per column, and they are the screen’s own labels', () => {
    const cells = headerCells(write([collection()]))
    expect(cells).toHaveLength(COLLECTIONS_CSV_COLUMNS.length)
    // The grid's header for the same column, through the same key — not a second
    // spelling invented for the file.
    expect(cells[0]).toBe(en.collections.columns.collectionReceiptNo)
    // A folded column, present with the toggle off because the file does not have
    // a toggle.
    expect(cells).toContain(en.collections.columns.retainedFloat)
    expect(cells).toContain(en.collections.columns.currencyKey)
  })

  it('and every data row has that many cells too', () => {
    const csv = write([collection(), collection({ collectionReceiptNo: 91001 })])
    expect(bodyLines(csv)).toHaveLength(2)
    for (const line of bodyLines(csv))
      expect(line.split(',')).toHaveLength(COLLECTIONS_CSV_COLUMNS.length)
  })

  it('Collection Attempts has no money column at all — an attempt collected nothing', () => {
    expect(ATTEMPTS_CSV_COLUMNS.some((c) => c.kind === 'money')).toBe(false)
  })

  it('the Deposits file carries no lines/attachments cell — a cell cannot hold a list', () => {
    const fields = DEPOSITS_CSV_COLUMNS.map((c) => c.field as string)
    expect(fields).not.toContain('lines')
    expect(fields).not.toContain('attachments')
  })
})

describe('an empty result still writes a readable file', () => {
  it('keeps the preamble and the headers, with no data rows', () => {
    const csv = write([])
    expect(csv.startsWith(`${BOM}sep=,\r\n`)).toBe(true)
    expect(headerCells(csv)).toHaveLength(COLLECTIONS_CSV_COLUMNS.length)
    expect(bodyLines(csv)).toHaveLength(0)
  })
})

describe('the file name carries the screen and the date', () => {
  it('is collection-{screen}-{YYYY-MM-DD}.csv', () => {
    expect(collectionCsvFileName('collections', new Date(2026, 7, 8))).toBe(
      'collection-collections-2026-08-08.csv',
    )
    expect(collectionCsvFileName('acrs', new Date(2026, 7, 8))).toBe('collection-acrs-2026-08-08.csv')
  })

  it('pads a single-digit month and day', () => {
    expect(collectionCsvFileName('deposits', new Date(2026, 0, 3))).toBe(
      'collection-deposits-2026-01-03.csv',
    )
  })

  it('carries no time — three exports in one day deliberately collide', () => {
    const morning = collectionCsvFileName('attempts', new Date(2026, 7, 8, 9, 0))
    const evening = collectionCsvFileName('attempts', new Date(2026, 7, 8, 21, 30))
    expect(morning).toBe(evening)
  })
})
