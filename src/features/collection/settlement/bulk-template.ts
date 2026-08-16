/**
 * **The sheet's shape, handed out as a file** — the blank the accountant fills in
 * before the door on `/collection/settlement/upload` will take it.
 *
 * 🔑 **The columns are the SERVER's, not this file's.** Nothing on this side parses
 * a sheet (`BulkUploadDialog`'s whole thesis), so this module cannot *define* the
 * format — it writes down the three headers `Settlement/Bulk/Preview` was proven to
 * read against a live SIS.Api (`.afk/FINDINGS-274.md`: *a real `.xlsx`
 * (`StoreCode`/`Amount`/`Reason`)*). If the door ever grows a fourth column, this
 * string is a place that must change with it, and it is one line.
 *
 * 🚩 **CSV, not XLSX, and deliberately.** The door accepts both, Excel opens a CSV
 * without ceremony, and writing a real `.xlsx` would mean the spreadsheet dependency
 * ticket 273 forbade — added not to read a file but to hand out an empty one.
 *
 * ⚠️ **The example rows cannot post.** Their branch codes resolve to nothing, so a
 * template uploaded unedited is refused by the preview's own row-level guard
 * (`reviewBulk`'s `UNRESOLVED_BRANCH_CODE`) rather than quietly posting money onto a
 * real branch on the strength of an illustration. That is the whole reason the
 * placeholders are not the realistic-looking `1001`.
 *
 * Pure: a string in, a string out. No DOM, no `t()` — the download lives at the call
 * site, and every word a reader sees is the `settlement` namespace's.
 */

/** The headers, in the order finance will read them. Order is not load-bearing on
 *  the wire — the door reads columns by NAME, which is what `bulk.file.hint` tells
 *  the accountant — but a template still has to pick one, so it picks the order the
 *  preview grid draws. */
export const BULK_TEMPLATE_COLUMNS = ['StoreCode', 'Amount', 'Reason'] as const

/** The file the download offers. Dated by nothing and named by nothing the reader
 *  has to type — a name that changes per download is a second copy in the Downloads
 *  folder nobody can tell apart. */
export const BULK_TEMPLATE_FILENAME = 'settlement-audit-template.csv'

/**
 * The template's bytes.
 *
 * ⚠️ **Amounts are written bare — no thousands separator, no currency symbol.** This
 * is `csv.ts`'s money ruling one screen over, and here it is the *input* side of it:
 * `1,250.00` in a cell is text with a comma in it, which in a CSV is two columns and
 * to the door is a malformed row. The example row is the only place this client can
 * say so without words.
 *
 * 🚩 No BOM and no `="…"` wrappers. This file is written to be **re-read by the
 * server**, not summed in Excel — the identity-quoting `csv.ts` needs for a
 * reconciliation workbook would arrive at the parser as literal `="1001"`.
 */
export function bulkTemplateCsv(): string {
  const rows: readonly (readonly string[])[] = [
    BULK_TEMPLATE_COLUMNS,
    ['EXAMPLE-1', '1250.00', 'Example row - replace it with the branch, the amount and the reason'],
    ['EXAMPLE-2', '75.5', 'Example row - delete every EXAMPLE row before uploading'],
  ]
  // CRLF: the file is opened in Excel far more often than it is diffed, and a
  // lone-LF CSV is the one that arrives as a single line in older Windows readers.
  return rows.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Minimal RFC-4180 quoting — enough for the fixed strings above, and honest if one
 *  of them ever grows a comma. Nothing here is user input, so there is no
 *  formula-injection guard: adding one would put a leading `'` into a header the
 *  server matches by name. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
