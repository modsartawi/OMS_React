/**
 * The LF return panel's pure projection (spec 759 F4, ticket 762; BackOffice 3369 §Wire, read 3376).
 *
 * Free of React so the outcome → chip mapping and the pending-vs-zero rule are plain data.
 */
import type { LfReturnDetailModel, LfReturnOutcome } from '@/core/models/lf-return'
import { needsAction, normaliseLfReturnOutcome, type LfReturnOutcomeReading } from '@/core/oms/lf-return-outcome'
import type { Severity } from '@/core/ui/severity'
import { isBlankDate } from '@/core/util/date-format'
import type { OpenedAs } from './actions'

/** What decides whether the page asks 3376's read at all. */
export interface LfReturnPanelContext {
  /** The ROUTE's answer: a return delivery is opened from the delivery route. */
  openedAs: OpenedAs
  /** The payload's category — `T` is a delivery return (the `9000000003` capture). */
  documentCategory: string | null | undefined
  /** The probe's `canCreateLocalFulfillmentReturn` (03), read strictly. */
  canCreateLocalFulfillmentReturn?: boolean
}

/** `documentCategory` of a delivery return. */
const RETURN_CATEGORY = 'T'

/**
 * Whether the page asks the LF return detail read (spec 759 F4): a delivery RETURN, on the delivery
 * route, for a 03 holder. Whether the return's forward delivery is `LF` is NOT inferred here — not
 * from the store, not from the return's own type: 3376's read decides it, answering a watch for an
 * LF return and none for a bonded one ({@link showsLfReturnPanel}). A forward delivery (category
 * `D`) is never a return, so it is never asked.
 */
export function asksLfReturn(ctx: LfReturnPanelContext): boolean {
  return (
    ctx.canCreateLocalFulfillmentReturn === true &&
    ctx.openedAs === 'delivery' &&
    (ctx.documentCategory ?? '').trim() === RETURN_CATEGORY
  )
}

/** Whether the panel is drawn: the page asked, and the read answered a watch (an LF return). */
export function showsLfReturnPanel(ctx: LfReturnPanelContext, read: LfReturnDetailModel | null | undefined): boolean {
  return asksLfReturn(ctx) && read != null
}

const SEVERITY: Record<LfReturnOutcome, Severity> = {
  // Booked and in motion: nothing for a human to do yet.
  open: 'go',
  refunded: 'ok',
  // The three that need a human (3369's needing-action set).
  short: 'warn',
  nothingReceived: 'warn',
  unanswered: 'warn',
  // Settled by an operator: done, the customer is paid.
  forced: 'ok',
}

export interface OutcomeChip {
  /** The outcome as read (`normaliseLfReturnOutcome`): either spelling of a known one, or `unknown`. */
  code: LfReturnOutcomeReading
  sev: Severity
  /** `document` keys: the chip's word and its meaning in a sentence. */
  labelKey: string
  meaningKey: string
  /** `false` for an outcome the client has not learned — the page shows its raw code beside it. */
  known: boolean
}

/** An outcome as its status chip and its meaning in words. An unlearned one is neutral, never a guess. */
export function outcomeChip(outcome: string | null | undefined): OutcomeChip {
  const code = normaliseLfReturnOutcome(outcome)
  return {
    code,
    sev: code === 'unknown' ? 'mute' : SEVERITY[code],
    labelKey: `lfReturn.outcomes.${code}.label`,
    meaningKey: `lfReturn.outcomes.${code}.meaning`,
    known: code !== 'unknown',
  }
}

/**
 * The attention banner's `document` key — saying action is needed and what kind — or `null` for an
 * outcome that needs none. An outcome the client has not learned raises nothing: the chip already
 * says it is unknown, and a banner would be a guess.
 */
export function attentionKey(outcome: string | null | undefined): string | null {
  const code = normaliseLfReturnOutcome(outcome)
  return needsAction(code) ? `lfReturn.attention.${code}` : null
}

/** A quantity cell: a number the server stands behind, or *pending* — never a `0` it did not mean. */
export type Quantity = { pending: true } | { pending: false; value: number }

/** One line of the panel, its quantities already decided pending or real. */
export interface LfReturnRow {
  itemNumber: string
  sku: string
  asked: Quantity
  confirmed: Quantity
  refunded: Quantity
  restocked: Quantity
  reasonName: string
}

const PENDING: Quantity = { pending: true }

function quantity(value: number | null | undefined, pending: boolean): Quantity {
  return pending || typeof value !== 'number' || !Number.isFinite(value) ? PENDING : { pending: false, value }
}

/** Whether a wire date carries an instant (absent, blank, invalid and .NET's `0001-01-01` do not). */
function hasDate(value: string | null | undefined): boolean {
  return !!value && !isBlankDate(new Date(value))
}

/**
 * The panel's rows (spec 759 F4). An unconfirmed quantity is **pending, never `0`**:
 *
 * - *confirmed* is pending until the watch carries `confirmedAt` — a `0` the server sends before the
 *   warehouse answered is a placeholder, not a count (and a `forced` return the warehouse never
 *   confirmed keeps it pending);
 * - *refunded* and *restocked* are pending while the watch still waits — `open` (the warehouse has
 *   not answered) and `unanswered` (the refund waits on an operator);
 * - any quantity the server leaves absent or non-numeric is pending.
 */
export function lfReturnRows(detail: LfReturnDetailModel): LfReturnRow[] {
  const code = normaliseLfReturnOutcome(detail.outcome)
  const confirmedPending = !hasDate(detail.confirmedAt)
  const settledPending = code === 'open' || code === 'unanswered'
  return (detail.lines ?? []).map((l) => ({
    itemNumber: (l.itemNumber ?? '').trim(),
    sku: (l.sku ?? '').trim(),
    asked: quantity(l.askedQuantity, false),
    confirmed: quantity(l.confirmedQuantity, confirmedPending),
    refunded: quantity(l.refundedQuantity, settledPending),
    restocked: quantity(l.returnedToStock, settledPending),
    reasonName: (l.reasonName ?? '').trim(),
  }))
}
