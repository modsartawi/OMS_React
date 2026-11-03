/**
 * How the drill reads what became of a delivery after the take (ticket 714, spec 3326, BO 3339). Pure,
 * pinned by `after-take.test.ts`.
 *
 * 🚩 The courier's reason is shown exactly as sent: no translation, no mapping, no conclusion. Nothing
 * here (or in the locale) ever says "no stock" — "Order Not Found in branch" may mean not ready.
 */
import type {
  CalloutOfferedLine,
  DispatchScorecardDrillItem,
  DispatchScorecardDrillRow,
  DispatchScorecardFigure,
  DispatchScorecardRefusedClose,
} from '@/core/models/dispatch-scorecard'
import { formatPair, formatParts } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'

const AFTER_TAKE_FIGURES: ReadonlySet<DispatchScorecardFigure> = new Set<DispatchScorecardFigure>([
  'failedTakes',
  'failedTakeRate',
  'fallbackCancels',
  'refusedCloses',
])

/** Whether a figure's drill reads the after-take columns (taker, closer, reason, courier, items, stock). */
export function showsAfterTake(figure: DispatchScorecardFigure): boolean {
  return AFTER_TAKE_FIGURES.has(figure)
}

/** The i18n key of an outcome in words; `null` when nothing happened after the take yet. */
export function afterTakeKey(outcome: string | undefined): string | null {
  return outcome ? `afterTake.${outcome}` : null
}

export type AfterTakeReason = { kind: 'text'; text: string } | { kind: 'noReason' } | { kind: 'none' }

type ReasonFields = Pick<DispatchScorecardDrillRow, 'afterTakeOutcome' | 'afterTakeReason' | 'afterTakeCourier'>

/**
 * The reason as given: the text exactly as sent; a courier cancel with none reads "No reason given";
 * anything else with none shows nothing.
 */
export function afterTakeReason(row: Partial<ReasonFields>): AfterTakeReason {
  const text = row.afterTakeReason ?? ''
  if (text.trim() !== '') return { kind: 'text', text }
  const courierCancel = (row.afterTakeCourier ?? '') !== '' || (row.afterTakeOutcome ?? '').startsWith('Courier')
  return courierCancel ? { kind: 'noReason' } : { kind: 'none' }
}

/** One item as one machine value: `100234 · 2 EA`. */
export function itemText(item: DispatchScorecardDrillItem): string {
  return formatPair(item.itemNumber, `${formatNumber(item.quantity)} ${item.uom ?? ''}`.trim())
}

/** The items in one cell (the export); none reads the dash. */
export function itemsText(items: readonly DispatchScorecardDrillItem[] | undefined, dash: string): string {
  return items?.length ? items.map(itemText).join('; ') : dash
}

/** A short line's values for `drill.shortLine`; `available` `null` = no stock row on record ("Not on record"). */
export function shortLineParts(line: CalloutOfferedLine): { material: string; needed: string; available: string | null } {
  return {
    material: line.material,
    needed: formatNumber(line.neededBase),
    available: line.availableBase == null ? null : formatNumber(line.availableBase),
  }
}

/** One refused attempt as one line: time · who · till · reason (a blank part reads the dash). */
export function attemptText(attempt: DispatchScorecardRefusedClose, dash: string): string {
  const or = (v: string | undefined) => (v && v.trim() !== '' ? v : dash)
  return formatParts([or(formatDateTime(attempt.at)), or(attempt.closedBy), or(attempt.register), or(attempt.reason)])
}

/**
 * Whether a row shows the 6-month note: a refusedCloses row whose attempts are gone (the events are
 * swept after 6 months; the count still stands). Never an error.
 */
export function attemptsSwept(figure: DispatchScorecardFigure, row: Pick<DispatchScorecardDrillRow, 'refusedAttempts'>): boolean {
  return figure === 'refusedCloses' && !(row.refusedAttempts?.length)
}

/** A `<Trans>`-tagged sentence as plain text, for the export: the slot tags dropped, the words kept. */
export function plainText(tagged: string): string {
  return tagged.replace(/<\/?[a-z]+>/gi, '')
}
