/**
 * **The assignment sheet's shape, handed out as a file** (ticket 318) — the blank
 * finance fills in before the upload on the Branches tab will read it.
 *
 * 🔑 **The columns are the SERVER's, not this file's.** Nothing on this side parses a
 * sheet, so this module cannot define the format; it writes down the header BackOffice
 * 1996's contract names exactly — `StoreCode | AccountantId | CollectorId`, one branch
 * per row. The door reads columns by NAME, in any order; a template still has to pick
 * one, so it picks the contract's.
 *
 * 🚩 **CSV, not XLSX** — `settlement/bulk-template.ts`'s ruling: the door takes both,
 * Excel opens a CSV without ceremony, and a real `.xlsx` would need a spreadsheet
 * dependency added only to hand out an empty file.
 *
 * ⚠️ **The header and nothing else — no example rows**, unlike the settlement template.
 * This file is all or nothing: an example row left in above finance's own rows would be
 * refused (`UNKNOWN_STORE`) and take the whole sheet down with it. The one rule a reader
 * would not guess — a blank cell leaves that side as it is — is said on screen beside
 * the download instead.
 *
 * Pure: a string out. No DOM, no `t()`.
 */

export const ASSIGNMENT_TEMPLATE_COLUMNS = ['StoreCode', 'AccountantId', 'CollectorId'] as const

/** One name for every download — a dated name is a second copy nobody can tell apart. */
export const ASSIGNMENT_TEMPLATE_FILENAME = 'collection-assignment-template.csv'

/**
 * The template's bytes: the header row, CRLF-terminated (the file is opened in Excel far
 * more often than it is diffed). No BOM and no `="…"` wrappers — it is written to be
 * re-read by the server. The three names need no quoting.
 */
export function assignmentTemplateCsv(): string {
  return ASSIGNMENT_TEMPLATE_COLUMNS.join(',') + '\r\n'
}
