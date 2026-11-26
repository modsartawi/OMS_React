/**
 * The results page's colours (ticket 971): every one a `--results-*` token in `src/app/global.css`, light and dark. A
 * class has a colour of its own and the colours rank nothing — no green and no red on the page (spec 4354 §17,
 * results ticket decision 3).
 */
import type { ResultsClass, ResultsEnding, ResultsSegment, ResultsShipMode } from '@/core/models/sourcing-results'

const token = (name: string) => `var(--results-${name})`

const SEGMENT_INK: Record<ResultsSegment, string> = {
  SAME_PLAN: token('same'),
  SAME_STORES_OTHER_WAY: token('split'),
  ANOTHER_STORE: token('store'),
  CALLOUT_FALLBACK: token('fallback'),
  OUTSIDE_RULES: token('rules'),
  NOT_COMPARABLE: token('not-comparable'),
  BREAKS_NESTING: token('more'),
}
export const segmentInk = (segment: ResultsSegment): string => SEGMENT_INK[segment]

const CLASS_INK: Record<ResultsClass, string> = {
  SAME_PLAN: token('same'),
  ANOTHER_STORE: token('store'),
  ANOTHER_MODE: token('mode'),
  FEWER_SHIPMENTS: token('fewer'),
  MORE_SHIPMENTS: token('more'),
  CALLOUT_FALLBACK: token('fallback'),
  OUTSIDE_RULES: token('rules'),
  NOT_COMPARABLE: token('not-comparable'),
}
export const classInk = (cls: ResultsClass): string => CLASS_INK[cls] ?? token('not-comparable')

const ENDING_INK: Record<Exclude<ResultsEnding, 'NOT_ENDED'>, string> = {
  ON_TIME: token('end-on-time'),
  LATE: token('end-late'),
  RETURNED: token('end-returned'),
  CANCELLED: token('end-cancelled'),
  CUSTOMER_CANCELLED: token('end-customer'),
}
export const endingInk = (ending: Exclude<ResultsEnding, 'NOT_ENDED'>): string => ENDING_INK[ending]

const MODE_INK: Record<ResultsShipMode, string> = {
  DAWAA_NOW: token('dawaa-now'),
  SLOT: token('slot'),
  PICK_UP: token('pick-up'),
  CARRIER_SAME_DAY: token('carrier'),
  CARRIER_NEXT_DAY: token('carrier'),
  BEYOND_BORDER: token('carrier'),
}
export const modeInk = (mode: ResultsShipMode): string => MODE_INK[mode] ?? token('carrier')

/** The single neutral colour of the estimate's dot and bar. */
export const ESTIMATE_INK = token('estimate')

/** The diagonal hatch over a segment that is shown and not counted (or counted apart). */
export const HATCH = 'repeating-linear-gradient(135deg, transparent 0 3px, var(--results-hatch) 3px 6px)'
