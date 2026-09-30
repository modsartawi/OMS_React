// The Collections Excel export (ticket 336, BackOffice spec 2149 D4): the four grids write a
// real `.xlsx` through the app's one grid writer, `@/core/util/grid-xlsx`.
//
// **The file is the grid as shown** — the rows left after the filter row, in the sort the
// accountant clicked, under the columns on screen. 🚩 That includes the *More columns*
// toggle: ticket 258's CSV wrote every column whatever the toggle said, and D4 rules the
// other way. A folded column is in the file when it is on screen, and not otherwise.
//
// What this module adds to the shared writer is the one thing only the screen knows —
// **which columns are figures**:
//
// - **Money and counts** leave as numbers, so the accountant can total them.
// - **Everything else is the text the cell shows.** A receipt, ACR or deposit number is a
//   number on the wire and an identity in the workbook; written as a number Excel would
//   total it, and reshape a long one. Store codes and ids are strings already and keep
//   their leading zeros. Dates keep the screen's format.
// - The **actions** column holds links and no value, so it is left out.
//
// Arabic needs nothing: a workbook is UTF-8 by definition, which is what retired the CSV's
// BOM and `sep=` line.

import type { GridApi } from 'ag-grid-community'

import { gridSheet, writeWorkbook, type XlsxSheet } from '@/core/util/grid-xlsx'

import type { AcrInquiryRow, CollectionInquiryRow } from '@/core/models/collection'

import { MONEY_FIELDS as ACR_MONEY_FIELDS } from './acr-columns'
import { MONEY_FIELDS as COLLECTIONS_MONEY_FIELDS } from './collections-columns'
import { MONEY_FIELDS as DEPOSITS_MONEY_FIELDS } from './deposit-columns'
import { ACTIONS_COLUMN } from './RowActions'

/**
 * The four screens, as the file-name slug **and** the `collection` namespace's
 * section for the button label and the sheet's name.
 *
 * 🚩 A union rather than a `string`: the slug names the file an accountant will go
 * looking for in a shared folder months later, and a typo would quietly write
 * `collection-collectons-2026-08-08.xlsx` with nothing to catch it.
 */
export type CollectionScreen = 'collections' | 'acrs' | 'deposits' | 'attempts'

/**
 * Each screen's figures, by column id — the only columns written as numbers.
 *
 * The money lists are the screens' own `MONEY_FIELDS`, so a money column added to a
 * grid is numeric in its file with no edit here. The counts are quantities too (slips,
 * linked receipts) and an accountant may well total them.
 *
 * 🚩 The default is TEXT: a numeric column nobody listed leaves as the text the cell
 * shows, which reads correctly and merely does not total. The other default would
 * silently turn a new document number into a figure.
 *
 * Collection Attempts has none — an attempt collected nothing.
 */
const COLLECTIONS_COUNT_FIELDS = [
  'cardTransactionCount',
  'slipCount',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

const ACR_COUNT_FIELDS = [
  'linkedCollectionCount',
  'cardTransactionCountSum',
] as const satisfies readonly (keyof AcrInquiryRow)[]

const NUMERIC_COLUMNS: Record<CollectionScreen, ReadonlySet<string>> = {
  collections: new Set<string>([...COLLECTIONS_MONEY_FIELDS, ...COLLECTIONS_COUNT_FIELDS]),
  acrs: new Set<string>([...ACR_MONEY_FIELDS, ...ACR_COUNT_FIELDS]),
  deposits: new Set<string>(DEPOSITS_MONEY_FIELDS),
  attempts: new Set<string>(),
}

/**
 * One screen's grid as a worksheet named `name`: the shown columns minus the actions,
 * the screen's figures as numbers and every other cell as its shown text.
 */
export function collectionSheet<Row>(
  api: GridApi<Row>,
  screen: CollectionScreen,
  name: string,
): XlsxSheet & { rows: Row[]; count: number } {
  const numeric = NUMERIC_COLUMNS[screen]
  return gridSheet(api, name, {
    skip: (colId) => colId === ACTIONS_COLUMN,
    asText: (colId) => !numeric.has(colId),
  })
}

/**
 * A worksheet name Excel accepts: none of `\ / ? * [ ] :` and at most 31 characters.
 * The name is the screen's translated title, so it is not this module's to trust.
 */
export function sheetName(title: string): string {
  return title
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31)
}

/**
 * `collection-{screen}-{YYYY-MM-DD}.xlsx` — ticket 258's name with the new extension.
 * Date only, no time: three exports in one week do not collide, three in one day
 * deliberately do. (Not `xlsxFileName`, which stamps the minute.)
 *
 * `now` is a parameter so the name is testable and this function stays pure.
 */
export function collectionXlsxFileName(screen: CollectionScreen, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `collection-${screen}-${day}.xlsx`
}

/**
 * Write the current view of one grid to an `.xlsx` download. No server call: the whole
 * matched result is held client-side (244 §3), so the grid is the file.
 *
 * `screen` is the file-name slug — a machine token, not a label, so it is deliberately
 * not localised: a file name has to be greppable in a shared folder months later.
 */
export async function exportGridToXlsx<Row>(
  api: GridApi<Row>,
  screen: CollectionScreen,
  title: string,
  now: Date,
): Promise<void> {
  await writeWorkbook([collectionSheet(api, screen, sheetName(title))], collectionXlsxFileName(screen, now))
}
