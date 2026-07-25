/**
 * The items grid's two data rules (spec 083 D-9, ticket 093), pure and beside
 * `columns.ts`: the pinned totals row computed from `lines`, and the discount
 * flag.
 *
 * They live here rather than inside the column definitions for the reason the
 * rail and the field resolutions do: a reducer and a predicate are where a
 * regression is silent, and neither needs AG Grid to be exercised. `t` is passed
 * in, never imported, so the footer label comes from i18n without binding the
 * rule to module state.
 */
import type { SdDocumentLineModel } from '@/core/models/sd-document'

/** The pinned footer's five figures. */
export interface LineTotals {
  /** How many lines the document carries — deleted ones included. */
  lineCount: number
  quantity: number
  grossAmount: number
  vatAmount: number
  netAmount: number
}

/** The translator, passed in. Same contract as `rail.ts`'s `TFn`. */
type TFn = (key: string, options?: Record<string, unknown>) => string

/** A payload number, or `0` — live lines emit `null` where the model says `number`. */
function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Round off binary-float dust: `0.1 + 0.2` must not reach the footer as
 * `0.30000000000000004`. Three decimals is past every precision the wire
 * carries (money is two, quantities are whole or fractional packs) and the money
 * columns then format to two.
 *
 * `formatMoney` would hide the dust on the three amount columns anyway — but
 * `quantity` renders through `formatNumber`, which prints the number as-is.
 */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Σ one field across the lines, dust removed. */
function total(lines: SdDocumentLineModel[], pick: (line: SdDocumentLineModel) => unknown): number {
  return round(lines.reduce((sum, line) => sum + finiteOrZero(pick(line)), 0))
}

/**
 * Sum one document's lines.
 *
 * **Deleted lines are counted and summed.** The grid shows them (struck, not
 * hidden), and a footer that silently disagreed with the rows above it would be
 * a worse reading hazard than one that includes a line the operator can see is
 * struck.
 *
 * Known and out of scope (spec 083 D-9): line `vatAmount` disagrees with the
 * `VATF` condition on `8000000121`, so this footer agrees with the grid and
 * disagrees with the Header Conditions tab. That is a data-correctness question.
 */
export function lineTotals(lines: SdDocumentLineModel[] | null | undefined): LineTotals {
  const rows = lines ?? []
  return {
    lineCount: rows.length,
    quantity: total(rows, (line) => line.quantity),
    grossAmount: total(rows, (line) => line.grossAmount),
    vatAmount: total(rows, (line) => line.vatAmount),
    netAmount: total(rows, (line) => line.netAmount),
  }
}

/**
 * Whether a line's discount takes the amber flag.
 *
 * `!== 0`, **not `> 0`** — the rule this replaces never fired, because every
 * real discount in the corpus is negative (`-1.500`, a promotion). The value
 * itself renders as the payload carries it, sign included: suppressing the sign
 * would put the grid in disagreement with both the API and the Header Conditions
 * tab one tab away.
 */
export function isDiscountFlagged(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0
}

/**
 * The grid's `pinnedBottomRowData` — one synthetic line, or none at all when the
 * document has no lines (the grid renders its empty state instead).
 *
 * The label lands in `itemDescription` because that is the grid's FIRST column:
 * the totals read as a sentence at the start of the row, with the sums under
 * their own columns. `unitPrice` and `discount` stay blank — a summed unit price
 * is meaningless and a summed discount would invite the eye to reconcile it
 * against the conditions tab.
 *
 * These are the DOCUMENT's totals, not the filtered view's: the row is computed
 * once from `lines` and a column filter does not recompute it. That is what spec
 * 083 D-9 asks for — the footer answers "what is on this document", which is the
 * question the operator opened the screen with.
 *
 * The cast is the same widening `columns.ts` uses for a bound field name: AG Grid
 * types pinned rows as full row objects, and a totals row is deliberately partial.
 */
export function totalsFooterRow(
  lines: SdDocumentLineModel[] | null | undefined,
  t: TFn,
): SdDocumentLineModel[] {
  const totals = lineTotals(lines)
  if (totals.lineCount === 0) return []
  const row = {
    // `4 lines · 7 units` — two independently pluralised fragments joined by a
    // key, not by a `·` written in code. i18next pluralises on ONE `count` per
    // call, and every corpus document carries exactly one line: a single
    // `{{lines}} lines` string would read `1 lines` on all five.
    itemDescription: t('items.totals', {
      lines: t('items.totalsLines', { count: totals.lineCount }),
      units: t('items.totalsUnits', { count: totals.quantity }),
    }),
    quantity: totals.quantity,
    grossAmount: totals.grossAmount,
    vatAmount: totals.vatAmount,
    netAmount: totals.netAmount,
  }
  return [row as unknown as SdDocumentLineModel]
}
