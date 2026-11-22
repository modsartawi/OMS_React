/**
 * The console grids' row ids (oms 940–945) — pure. AG Grid drops a row whose id another row of the page already has, and
 * the console's rows are keyed by parts the server may leave blank (a take with no id, a ledger line with no id, a stage
 * move with no time). A row is never dropped for it: a blank or repeated key falls back to the row's place on the page.
 */

/** A row's key from its parts, one string; '' when every part is blank — it names no row. */
export function rowKey(...parts: (string | number | null | undefined)[]): string {
  const text = parts.map((p) => (p === null || p === undefined ? '' : String(p)))
  return text.every((p) => p.trim() === '') ? '' : text.join('\u0000')
}

/** Each row's grid id on this page: its own key while that names it alone, else its place (`#<index>`). */
export function gridRowIds<T>(rows: readonly T[], idOf: (row: T) => string): Map<T, string> {
  const ids = new Map<T, string>()
  const taken = new Set<string>()
  rows.forEach((row, index) => {
    let id = idOf(row)
    if (id === '' || taken.has(id)) {
      id = `#${index}`
      while (taken.has(id)) id = `${id}#`
    }
    taken.add(id)
    ids.set(row, id)
  })
  return ids
}
