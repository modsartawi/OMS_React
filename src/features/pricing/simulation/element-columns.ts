/**
 * The elements trace's shed order (ticket 119, spec 110 §66/§67).
 *
 * **Shed, never scroll.** Of the screen's two tables only this one can outgrow its
 * column: it renders *inside* the Results frame, which is 66% of the work area above
 * the 900 px breakpoint, so at a 960 px work area the trace has ~584 px for eleven
 * columns. The results table itself never sheds and never scrolls — the breakpoint is
 * derived FROM its minimum, so it cannot drop below what seven columns need.
 *
 * The alternative — a horizontal scroller inside an expanding table row — is rejected:
 * a nested scroll region inside a disclosure is the one thing worse than a wide table.
 *
 * **Why this is a module and not three container-query `hidden` variants.** (Written
 * out rather than spelled as a class: Tailwind scans comments too, and an illustrative
 * arbitrary variant in prose compiles to a real, invalid rule.) The rule worth
 * guarding is *"no numeric column is ever shed"*, and the edit most likely to break it
 * is someone adding a column later and dropping it into the order without thinking.
 * As a level-to-column-list function that rule is one assertion across all three
 * levels (`element-columns.test.ts`); as CSS it is a scan of every `<th>` and `<td>`
 * in a table body, which is exactly the kind of check that is not run.
 *
 * `ctr` and `unit` are the only sheddable columns because they are **identifiers that
 * repeat down the column** — the condition counter is almost always `01`, the rate
 * unit almost always the same currency or `%`. Losing them costs a reader nothing they
 * cannot recover from the row above. A figure is never recoverable that way.
 */

/** The eleven trace columns, in the pricing procedure's own order. */
export type ElementColumnId =
  | 'step'
  | 'ctr'
  | 'type'
  | 'description'
  | 'base'
  | 'rate'
  | 'unit'
  | 'value'
  | 'statistical'
  | 'subtotal'
  | 'bonusBuy'

/**
 * What a column *is*, which is what decides whether it may ever be shed:
 *
 * - `figure` — a number the analyst is reading the trace FOR. Never shed.
 * - `identifier` — a code that repeats down the column and is recoverable from context.
 * - `text` — the description; it absorbs the width the shed frees, so shedding it
 *   would be self-defeating as well as unhelpful.
 * - `flag` — a boolean tick; already the narrowest thing on the row.
 */
export type ElementColumnRole = 'figure' | 'identifier' | 'text' | 'flag'

/** How much room a column needs before the trace has to shed something.
 *  Measured off the rendered table at `text-[11.5px]` with `px-2` cells. */
interface ColumnSpec {
  id: ElementColumnId
  role: ElementColumnRole
  minWidth: number
}

const COLUMNS: readonly ColumnSpec[] = [
  { id: 'step', role: 'identifier', minWidth: 46 },
  { id: 'ctr', role: 'identifier', minWidth: 46 },
  { id: 'type', role: 'identifier', minWidth: 58 },
  { id: 'description', role: 'text', minWidth: 170 },
  { id: 'base', role: 'figure', minWidth: 78 },
  { id: 'rate', role: 'figure', minWidth: 68 },
  { id: 'unit', role: 'identifier', minWidth: 54 },
  { id: 'value', role: 'figure', minWidth: 80 },
  { id: 'statistical', role: 'flag', minWidth: 46 },
  { id: 'subtotal', role: 'flag', minWidth: 46 },
  { id: 'bonusBuy', role: 'flag', minWidth: 54 },
]

export const ELEMENT_COLUMNS: readonly ElementColumnId[] = COLUMNS.map((c) => c.id)

/** The shed order: `ctr` first, then `unit`, and then nothing — the trace has no third
 *  identifier it can afford to lose, so `tight` is terminal. */
export const SHED_ORDER: readonly ElementColumnId[] = ['ctr', 'unit']

/** One level per shed, plus the un-shed one. */
export type TraceLevel = 'full' | 'compact' | 'tight'

export const TRACE_LEVELS: readonly TraceLevel[] = ['full', 'compact', 'tight']

export function columnRole(id: ElementColumnId): ElementColumnRole {
  // Non-null: `ElementColumnId` is the union of the table's own ids.
  return COLUMNS.find((c) => c.id === id)!.role
}

/** The columns a level renders, in the procedure's order. */
export function elementColumns(level: TraceLevel): ElementColumnId[] {
  const shed = new Set(SHED_ORDER.slice(0, TRACE_LEVELS.indexOf(level)))
  return COLUMNS.filter((c) => !shed.has(c.id)).map((c) => c.id)
}

/** The room a level's columns need — the sum of their minimums. The thresholds below
 *  are consequences of this table rather than three hand-picked numbers. */
export function traceMinWidth(level: TraceLevel): number {
  const kept = new Set<ElementColumnId>(elementColumns(level))
  return COLUMNS.filter((c) => kept.has(c.id)).reduce((sum, c) => sum + c.minWidth, 0)
}

/** The widest level that fits the measured trace width — `tight` when nothing does,
 *  because the trace answers a too-narrow column by shedding, never by dropping a
 *  figure and never by scrolling. */
export function traceLevel(width: number): TraceLevel {
  return TRACE_LEVELS.find((level) => width >= traceMinWidth(level)) ?? 'tight'
}
