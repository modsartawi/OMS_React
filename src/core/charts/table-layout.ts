/**
 * How the table form sizes its grid.
 *
 * AG Grid's `domLayout: 'autoHeight'` grows the grid to fit every row, so it renders EVERY row into the
 * DOM: row virtualisation is off. A view of a year by day × store has thousands of rows, which froze
 * the page. So a short table keeps auto height (no inner scrollbar, sized to its rows); past
 * `TABLE_AUTO_HEIGHT_MAX_ROWS` it gets a fixed viewport with its own scrollbar, and AG Grid renders only
 * the rows in sight.
 */
export const TABLE_AUTO_HEIGHT_MAX_ROWS = 20

/** Rows shown in the fixed viewport of a long table. */
export const TABLE_VIEWPORT_ROWS = 18

export type TableLayout = { kind: 'auto' } | { kind: 'fixed'; heightPx: number }

export function tableLayout(rowCount: number, rowHeight: number, headerHeight: number): TableLayout {
  if (rowCount <= TABLE_AUTO_HEIGHT_MAX_ROWS) return { kind: 'auto' }
  // + 2: the wrapper's border, so the last row in sight is never half hidden.
  return { kind: 'fixed', heightPx: headerHeight + rowHeight * TABLE_VIEWPORT_ROWS + 2 }
}
