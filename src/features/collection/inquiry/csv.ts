// The Collections CSV writer (ticket 258). Pure: rows in, string out — no DOM, no
// network, no `t` instance, just a header resolver. The grid walk and the download
// live in `export.ts`.
//
// **Why a writer at all, when `exportDataAsCsv` is right there.** The ticket asked
// this first, and the answer is not the one it expected: ag-grid-community 36.0.1
// *does* emit a BOM (`csvCreator` packages `new Blob(["﻿", data])`), so the
// stated blocker is stale. What rules it out is narrower and harder — 254–256
// implement **More columns** by *rebuilding* `columnDefs`, not by setting `hide`,
// so the forensic tail columns do not exist in the grid while the toggle is off.
// `allColumns: true` exports the grid's *hidden* columns; it cannot export a column
// that was never defined. "Every column ships regardless of the toggle" is
// therefore unreachable through AG Grid without rewriting three shipped slices.
// Recorded with the evidence in `.afk/HITL-258.md`.
//
// **The rule this file exists for, and the one thing that looks right while being
// wrong:** the two escaping rules are split **by column class**.
//
// - **Money** leaves as a bare, unformatted number. No thousands separator, no
//   symbol, no wrapper. ⚠️ The accountant SUMS this column, and `="1,234.50"` is
//   *text* — `SUM` over it silently reads **zero**. This is the deliberate
//   departure from `features/admin/ua-admin/csv.ts`, which wraps every cell.
// - **Identity** — a code that identifies a record, a person or a place, never a
//   quantity — keeps that `="…"` wrapper, because the reconciliation workbook keys
//   on receipt and ACR numbers and Excel would otherwise eat a leading zero or
//   render a long id as `1.23457E+11`.
// - **Free text** keeps the formula-injection guard: a display name must not
//   *execute* when the file opens.
//
// 🚩 The escaping primitives below overlap `ua-admin/csv.ts` almost line for line.
// They are deliberately **not** extracted to `@/core`: two consumers that differ in
// every column rule are not yet an abstraction, and this is the graduation
// candidate for whoever lands the *third* — exactly the path `pager.ts` and
// `money.ts` took (ticket 258, Boundaries).

import type {
  AcrInquiryRow,
  CollectionAttemptRow,
  CollectionInquiryRow,
  DepositInquiryRow,
} from '@/core/models/collection'
import { formatDay, isBlankDate } from '@/core/util/date-format'

import {
  DEFAULT_FIELDS as ACR_DEFAULT_FIELDS,
  MORE_FIELDS as ACR_MORE_FIELDS,
} from './acr-columns'
import {
  DEFAULT_FIELDS as ATTEMPTS_DEFAULT_FIELDS,
  MORE_FIELDS as ATTEMPTS_MORE_FIELDS,
} from './attempts-columns'
import {
  DEFAULT_FIELDS as COLLECTIONS_DEFAULT_FIELDS,
  MORE_FIELDS as COLLECTIONS_MORE_FIELDS,
} from './collections-columns'
import {
  DEFAULT_FIELDS as DEPOSITS_DEFAULT_FIELDS,
  MORE_FIELDS as DEPOSITS_MORE_FIELDS,
} from './deposit-columns'

/**
 * What class of thing a column holds — which is the only question the writer asks
 * about a cell, because it is the question the two escaping rules split on.
 *
 * - `money` — an amount. Bare and summable, always.
 * - `count` — a number of things (card slips, linked receipts). Bare too: it is a
 *   quantity, and an accountant may well total a column of them.
 * - `identity` — a record/person/place key. `="…"`, so Excel keeps it verbatim.
 * - `date` — a wire datetime, written as its raw ISO text so it sorts.
 * - `day` — a day-only wire value, written as `yyyy-MM-dd`.
 * - `text` — free text. Injection-guarded.
 */
export type CsvCellKind = 'money' | 'count' | 'identity' | 'date' | 'day' | 'text'

/** One column of the file: which field it reads and how that field escapes. */
export interface CsvColumn<Row> {
  field: keyof Row & string
  kind: CsvCellKind
}

/** Anything that can turn a field name into its header label — in the app, `t`. */
export type HeaderResolver = (field: string) => string

/**
 * The four screens, as the file-name slug **and** the `collection` namespace's
 * section for the headers and the button label.
 *
 * 🚩 A union rather than a `string`: the slug names the file an accountant will go
 * looking for in a shared folder months later, and a typo would quietly write
 * `collection-collectons-2026-08-08.csv` with nothing to catch it.
 */
export type CollectionScreen = 'collections' | 'acrs' | 'deposits' | 'attempts'

const BOM = '﻿'
const EOL = '\r\n'

/**
 * Quote a cell only when it needs it. A comma, a quote or a line break inside an
 * Arabic store name is escaped RFC-4180 style (doubled quotes inside a quoted
 * field), so a name with a newline stays one row.
 */
function escape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * `="0000000005"` — the only wrapping Excel honours for "this is text". Plain
 * quoting does NOT stop it parsing the cell as a number: the leading zero is eaten
 * and a long numeric id arrives as `1.23457E+11`.
 *
 * ⚠️ **Never reached for a money column.** That is the whole point of the split.
 */
function formulaText(value: string): string {
  return value === '' ? '' : escape(`="${value.replace(/"/g, '""')}"`)
}

/**
 * A display name or a note must not EXECUTE when the file is opened. Excel treats
 * a cell opening `=`, `+`, `-` or `@` as a formula whatever the quoting, so free
 * text gets an apostrophe Excel eats on display.
 */
function freeText(value: string): string {
  return escape(/^[=+\-@]/.test(value) ? `'${value}` : value)
}

/**
 * A bare, summable figure. **No grouping, no currency symbol, no wrapper** — the
 * one cell class that must arrive in Excel as a *number*.
 *
 * A missing amount is an EMPTY cell rather than `0`: `formatMoneyIn` draws it
 * blank on screen for the same reason, and a zero written where the server sent
 * nothing would be summed as a fact. A real `0` still writes `0`.
 */
function bareNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

/**
 * A wire datetime as its raw ISO text, so the column sorts and keeps the seconds
 * the grid's `yyyy-MM-dd HH:mm` cell drops — the file is the row unpacked, not the
 * grid screenshotted.
 *
 * ⚠️ The .NET `0001-01-01` sentinel is an **absence** on these rows (an ACR still
 * open, a deposit never voided), so it writes blank rather than as a year-1 date.
 */
function isoDateTime(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  return isBlankDate(new Date(value)) ? '' : value
}

/** One cell, escaped by its column's class. */
function cell<Row>(row: Row, column: CsvColumn<Row>): string {
  const value = (row as Record<string, unknown>)[column.field]
  switch (column.kind) {
    case 'money':
    case 'count':
      return bareNumber(value)
    case 'identity':
      // 🚩 An identity that is the number **zero** is an absent identity, not the
      // record numbered zero: `depositNumber` is `0` until an ACR is banked, and
      // the ACR grid blanks it for exactly that reason. A `0` under **Deposit No#**
      // in a workbook reads as a deposit.
      if (value === 0 || value == null) return ''
      return formulaText(String(value))
    case 'date':
      return isoDateTime(value)
    case 'day':
      return formatDay(typeof value === 'string' ? value : null)
    case 'text':
      return freeText(value == null ? '' : String(value))
  }
}

/**
 * The whole file as one string.
 *
 * Opens in columns on a double-click in any regional setting, and this is the part
 * that makes the Arabic store and pharmacist names render rather than mojibake:
 * the BOM is what tells Excel the bytes are UTF-8, and the leading `sep=,` line is
 * because Excel's double-click path uses the OS list separator — `;` in Arabic
 * locales — not the comma. Accepted cost: one junk first row in non-Excel tools,
 * exactly as `ua-admin` accepted it.
 */
export function buildCollectionCsv<Row>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
  header: HeaderResolver,
): string {
  const headerRow = columns.map((c) => freeText(header(c.field))).join(',')
  const lines = [
    'sep=,',
    headerRow,
    ...rows.map((row) => columns.map((c) => cell(row, c)).join(',')),
  ]
  return BOM + lines.join(EOL) + EOL
}

/**
 * `collection-{screen}-{YYYY-MM-DD}.csv`. Date only, no time: three exports in one
 * week do not collide, three in one day deliberately do.
 *
 * `now` is a parameter so the name is testable and this module stays pure.
 *
 * 🚩 A near-twin of `ua-admin/csv.ts`'s `csvFileName`, minus its scope-slug
 * sanitiser — this screen slug is a fixed union, not a user-supplied label. Named
 * here so it is on the inventory that graduates to `@/core` with the escaping
 * primitives when a third consumer lands (ticket 258, Boundaries).
 */
export function collectionCsvFileName(screen: CollectionScreen, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `collection-${screen}-${day}.csv`
}

/**
 * Turn a screen's two field groups into the file's columns.
 *
 * 🚩 **This is what makes "every column ships regardless of the toggle" true by
 * construction rather than by vigilance.** The columns are the *union of the two
 * groups*, read from the screen's own `DEFAULT_FIELDS`/`MORE_FIELDS` — the same
 * lists `columns.test.ts` proves account for the whole wire row. A field added to
 * either group joins the file with no edit here, and the `kinds` record below is
 * typed over exactly those fields, so a new one **fails typecheck** until someone
 * says what class it is.
 */
function csvColumns<Row, Field extends keyof Row & string>(
  fields: readonly Field[],
  kinds: Record<Field, CsvCellKind>,
): readonly CsvColumn<Row>[] {
  return fields.map((field) => ({ field, kind: kinds[field] }))
}

type CollectionsField =
  | (typeof COLLECTIONS_DEFAULT_FIELDS)[number]
  | (typeof COLLECTIONS_MORE_FIELDS)[number]

/**
 * Cash Collections, in the grid's own reading order: the nine default columns then
 * the forensic tail.
 *
 * ⚠️ `currencyKey` rides as its own column rather than as a suffix on the money
 * headers, which is what the grid does when a result holds one currency. A header
 * whose shape changed with the result would make two exports of the same column
 * disagree — and the WPF's own ACR writer carries `CurrencyCode` as a column for
 * the same reason.
 */
export const COLLECTIONS_CSV_COLUMNS = csvColumns<CollectionInquiryRow, CollectionsField>(
  [...COLLECTIONS_DEFAULT_FIELDS, ...COLLECTIONS_MORE_FIELDS],
  {
    collectionReceiptNo: 'identity',
    storeId: 'identity',
    storeName: 'text',
    collectorName: 'text',
    collectedAt: 'date',
    netCollected: 'money',
    variance: 'money',
    cardTotal: 'money',
    varianceReasonCode: 'text',
    openedAt: 'date',
    closedAt: 'date',
    systemCash: 'money',
    countedCash: 'money',
    openingFloat: 'money',
    countedCashNet: 'money',
    // A number of pieces of paper, not an amount — but a quantity all the same, so
    // it leaves bare rather than wrapped.
    cardTransactionCount: 'count',
    varianceReasonText: 'text',
    collectorOperatorId: 'identity',
    // ⚠️ Free text, not identity: it is a *list* of Z-report ids in one cell, and
    // `="Z-1,Z-2"` would claim the whole list is one key.
    zReportIds: 'text',
    retainedFloat: 'money',
    closerOperatorId: 'identity',
    closerName: 'text',
    salesDate: 'day',
    currencyKey: 'text',
  },
)

type AcrField = (typeof ACR_DEFAULT_FIELDS)[number] | (typeof ACR_MORE_FIELDS)[number]

/**
 * ACRs. `netCollectedTotal` and `cardTotalSum` are the two summable columns.
 *
 * ⚠️ **No Currency column, because `AcrInquiryRow` carries no `currencyKey`** —
 * the wire's shape, not an omission here, and the same reason the grid's money
 * headers are bare (255). The client cannot state a currency that is not on the
 * wire, and inventing `SAR` would be wrong on a Bahrain run. Logged as a server
 * change in `.afk/HITL-255.md`; this file gains the column the day the field
 * lands, with no other edit.
 */
export const ACRS_CSV_COLUMNS = csvColumns<AcrInquiryRow, AcrField>(
  [...ACR_DEFAULT_FIELDS, ...ACR_MORE_FIELDS],
  {
    acrNumber: 'identity',
    label: 'text',
    collectorName: 'text',
    acrDate: 'day',
    status: 'text',
    linkedCollectionCount: 'count',
    netCollectedTotal: 'money',
    cardTotalSum: 'money',
    createdAt: 'date',
    closedAt: 'date',
    cardTransactionCountSum: 'count',
    collectorOperatorId: 'identity',
    depositNumber: 'identity',
    depositStatus: 'text',
    depositId: 'identity',
  },
)

type DepositField = (typeof DEPOSITS_DEFAULT_FIELDS)[number] | (typeof DEPOSITS_MORE_FIELDS)[number]

/**
 * Deposits — the flat row only.
 *
 * ⚠️ **No Currency column either**, for `AcrInquiryRow`'s exact reason:
 * `DepositInquiryRow` carries no `currencyKey`. Logged in `.afk/HITL-256.md`.
 *
 * 🚩 `lines` and `attachments` are absent because they are absent from both field
 * groups: a cell cannot hold a list, and `deposit-columns.ts` names them in
 * `NON_COLUMN_FIELDS` with that reason. They render in the stacked detail region,
 * and inventing a comma-joined cell for them here would be a second, unreviewed
 * shape for the same data.
 */
export const DEPOSITS_CSV_COLUMNS = csvColumns<DepositInquiryRow, DepositField>(
  [...DEPOSITS_DEFAULT_FIELDS, ...DEPOSITS_MORE_FIELDS],
  {
    depositNumber: 'identity',
    depositedAt: 'date',
    collectorName: 'text',
    bankName: 'text',
    status: 'text',
    calculatedAmount: 'money',
    realAmount: 'money',
    // ⚠️ Signed, and the sign is the server's: negative is a shortfall. It leaves
    // bare like any other amount — a minus sign is part of the number, and the
    // LTR-island rule that governs a negative figure on screen is a *rendering*
    // rule with no meaning in a file.
    diffAmount: 'money',
    reasonCode: 'text',
    createdAt: 'date',
    collectorOperatorId: 'identity',
    bankCode: 'identity',
    noteText: 'text',
    voidedBy: 'text',
    voidedAt: 'date',
    voidReason: 'text',
  },
)

type AttemptField =
  | (typeof ATTEMPTS_DEFAULT_FIELDS)[number]
  | (typeof ATTEMPTS_MORE_FIELDS)[number]

/**
 * Collection Attempts — 🚩 **the one file in the suite with no money column at
 * all**. An attempt collected nothing; that is what makes it an attempt. Its
 * absence is the screen, not an omission here.
 */
export const ATTEMPTS_CSV_COLUMNS = csvColumns<CollectionAttemptRow, AttemptField>(
  [...ATTEMPTS_DEFAULT_FIELDS, ...ATTEMPTS_MORE_FIELDS],
  {
    attemptTime: 'date',
    storeCode: 'identity',
    storeName: 'text',
    collectorName: 'text',
    reasonCode: 'text',
    reasonText: 'text',
    businessDay: 'day',
    shiftId: 'identity',
    collectorStaffId: 'identity',
  },
)
