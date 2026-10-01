/**
 * **The people sheet's shape, handed out as a file** (ticket 337) — the blank finance
 * fills in before the People tab's upload will read it.
 *
 * 🔑 **The columns are the SERVER's, not this file's.** Nothing on this side parses a
 * sheet; this writes down the header BackOffice 2156's Web contract names exactly —
 * `StaffId | Name | Role | SupervisorId`, one person per row. The door reads columns by
 * NAME, in any order, and requires all four (a blank cell is a value there, so a
 * missing column cannot be read as blank).
 *
 * 🚩 **CSV, not XLSX, and the header alone** — `assignment-template.ts`'s two rulings,
 * for the same reasons: the door takes both formats, and the file is all or nothing,
 * so an example row left in would refuse finance's own rows with it. The rules a reader
 * would not guess (a blank cell clears, the role words are English) are said on screen
 * beside the download.
 *
 * Pure: a string out. No DOM, no `t()`.
 */

export const PEOPLE_TEMPLATE_COLUMNS = ['StaffId', 'Name', 'Role', 'SupervisorId'] as const

/** One name for every download — a dated name is a second copy nobody can tell apart. */
export const PEOPLE_TEMPLATE_FILENAME = 'collection-people-template.csv'

/**
 * The template's bytes: the header row, CRLF-terminated. No BOM and no `="…"` wrappers —
 * it is written to be re-read by the server, as the other templates are.
 */
export function peopleTemplateCsv(): string {
  return PEOPLE_TEMPLATE_COLUMNS.join(',') + '\r\n'
}
