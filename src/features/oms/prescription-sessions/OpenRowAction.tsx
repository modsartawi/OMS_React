import type { OpenGridRow } from './open-row'

/**
 * The Open grid's row-action slot (ticket 545) — ticket 548's seam for "Close without invoice".
 *
 * The grid's `actions` column renders this for a row whose `view.rowAction` is true (a DISPENSED
 * row: `./open-row`), and nothing for any other. 545 builds no act, so the column stays hidden
 * while `OPEN_ROW_ACTION_ENABLED` is false. 548: build the write-off here (its button, its dialog
 * beside it), flip the flag, and add `columns.actions` to the namespace if the header wants a name.
 */
export const OPEN_ROW_ACTION_ENABLED = false

export default function OpenRowAction({ row }: { row: OpenGridRow }) {
  void row
  return null
}
