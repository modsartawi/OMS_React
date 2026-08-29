/**
 * The chrome the inspector's three sub-tables share — the conditions table
 * inside an open line, and the payments and FI panes on the document
 * (ticket 297).
 *
 * A class string, not a component: the tables differ in their columns and in
 * nothing else, and one `<th>` wrapper per table would be a Middle Man. Spelled
 * once here so the three cannot drift a padding apart. Not user-visible, so
 * `i18n-zero-literal` does not reach it.
 */
export const SUB_HEAD_CELL = 'border-b border-divider px-1.5 pb-1 font-bold'

/** …and its end-aligned twin, for the money columns. */
export const SUB_HEAD_CELL_END = `${SUB_HEAD_CELL} text-end`

/** The start-aligned form, which is every other column. */
export const SUB_HEAD_CELL_START = `${SUB_HEAD_CELL} text-start`

/** One body row of a sub-table. */
export const SUB_ROW = 'border-b border-divider text-[12px] last:border-b-0'
