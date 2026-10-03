import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { deliveryWindow } from '@/core/oms/delivery-window'
import { formatMoney } from '@/core/util/number-format'

// The Delivery timeline (spec 380 D1, ticket 396; rulings 369 §1–§4, amended by 368 §3).
//
// It lives in `@/core` because two features read it — the Deliveries list (its Status column
// and, from 397, the Delivery inspector) and Delivery details (402–403) — and features may
// never import each other. They share this DERIVATION, not a component: each surface maps its
// own model to one `TimelineInput` and draws the steps its own way.
//
// A step is REACHED from the current status columns, never from a time or `statusHistory`.
// Times are milestone times: on the list row they come from three row fields only; on Details
// they will come from the Log (S4 extends the input). A reached step with no source shows no
// time, never a guess.

/** The four lifecycle steps, then the two that can replace the step a delivery stopped at. */
export type TimelineStepKey = 'created' | 'ready' | 'out' | 'delivered' | 'requested' | 'cancelled'

/**
 * - `done`: reached and passed (or Delivered, which completes the timeline).
 * - `current`: the furthest step reached, while the delivery is still moving.
 * - `next`: the first step not reached yet (the one a slot window can be an expectation for).
 * - `later`: a step after `next`.
 * - `requested` / `cancelled`: the cancellation that replaced the next step. Both are final.
 */
export type TimelineStepState = 'done' | 'current' | 'next' | 'later' | 'requested' | 'cancelled'

/** A Rewind: returned by driver (`DRBK`), rescheduled (`DRSC`), courier changed (`DCHC`). */
export type RewindKind = 'returned' | 'rescheduled' | 'courierChanged'

export interface TimelineMarker {
  kind: RewindKind
  /** When the rewind happened, or null when the source cannot say. */
  time: string | null
}

/** The one input both models map to. */
export interface TimelineInput {
  /** A pick-in-store delivery has no Out for delivery step. */
  pickInStore: boolean
  readyStatus: string
  deliveryStatus: string
  closeStatus: string
  /** Milestone times the source can vouch for. A missing key is no time. */
  times: Partial<Record<TimelineStepKey, string>>
  /** The latest rewind, if the source can say. Shown only with a time. */
  rewind: TimelineMarker | null
  /** The delivery's window (`deliveryWindow()`), or `''` when neither source has one. */
  slotWindow: string
}

export interface TimelineStep {
  key: TimelineStepKey
  state: TimelineStepState
  /** A real milestone time, or null. Only a reached step (or the cancellation) carries one. */
  time: string | null
  /** The rewind marker, on the step the delivery fell back to (Created). */
  marker: TimelineMarker | null
  /**
   * The window the next step is expected in (367 §2), on the `next` step only. An
   * expectation, never a time: the surface styles it apart from a milestone.
   */
  expectedWindow: string | null
}

const normCode = (value: string | null | undefined) => (value ?? '').trim().toUpperCase()

/** A usable time: blank and the `0001-01-01` default are no time (369 §4). */
function realTime(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return v && !v.startsWith('0001') ? v : null
}

/** `closeStatus` → the step a cancellation puts in place of the next one. R is final (369 §2). */
function closeStep(closeStatus: string): 'requested' | 'cancelled' | null {
  const close = normCode(closeStatus)
  if (close === 'R') return 'requested'
  if (close === 'C' || close === 'N' || close === 'X') return 'cancelled'
  return null
}

/**
 * The Delivery timeline for one input.
 *
 * Created → Ready → Out for delivery → Delivered, without Out for a pick-in-store delivery.
 * The furthest reached step marks everything before it done; Delivered completes the timeline.
 * A cancellation keeps the reached steps done and REPLACES the next step; the later ones are
 * dropped, not greyed. A close on a delivered delivery replaces Delivered itself: Cancelled
 * after delivery (`X`) reads Created → Ready → Out → Cancelled, because the cancellation is the
 * fact that stands.
 */
export function timeline(input: TimelineInput): TimelineStep[] {
  const keys: TimelineStepKey[] = input.pickInStore
    ? ['created', 'ready', 'delivered']
    : ['created', 'ready', 'out', 'delivered']
  const ready = normCode(input.readyStatus)
  const delivery = normCode(input.deliveryStatus)
  const reached: Partial<Record<TimelineStepKey, boolean>> = {
    created: true,
    ready: ready === 'R' || ready === 'C',
    out: delivery === 'O',
    delivered: delivery === 'D',
  }
  let furthest = 0
  keys.forEach((key, i) => {
    if (reached[key]) furthest = i
  })
  const last = keys.length - 1
  const cancel = closeStep(input.closeStatus)
  // A cancellation after delivery stands in Delivered's place.
  const keptUpTo = cancel && furthest === last ? last - 1 : furthest

  const steps: TimelineStep[] = keys.slice(0, keptUpTo + 1).map((key, i) => ({
    key,
    state: i === furthest && !cancel && furthest !== last ? 'current' : 'done',
    time: realTime(input.times[key]),
    marker: null,
    expectedWindow: null,
  }))
  // Every rewind clears or invalidates the ready and delivery statuses (DRSC and DCHC clear
  // them, DRBK writes ready S and delivery B), so each one falls back to Created — the step that
  // is always on the timeline, however far the delivery has moved since. A rewind the source
  // cannot date is not shown: the marker needs the action's time (369 §3).
  if (input.rewind && realTime(input.rewind.time)) steps[0].marker = input.rewind

  if (cancel) {
    steps.push({ key: cancel, state: cancel, time: realTime(input.times[cancel]), marker: null, expectedWindow: null })
    return steps
  }
  // The window is read through `deliveryWindow()`, never the raw schedule fields: a live
  // capture carries From == To, which is no window.
  const expected = input.slotWindow.trim() || null
  keys.slice(furthest + 1).forEach((key, i) => {
    steps.push({ key, state: i === 0 ? 'next' : 'later', time: null, marker: null, expectedWindow: i === 0 ? expected : null })
  })
  return steps
}

/** Where the delivery stands now: the cancellation, else the current step, else Delivered. */
export function timelineNow(steps: TimelineStep[]): TimelineStep {
  return (
    steps.find((s) => s.state === 'requested' || s.state === 'cancelled') ??
    steps.find((s) => s.state === 'current') ??
    [...steps].reverse().find((s) => s.state === 'done') ??
    steps[0]
  )
}

/**
 * A pick-in-store delivery: the header codes it `P`; the list returns the description
 * (`PickInStore`), so both spellings count.
 */
function isPickInStore(deliveryType: string | null | undefined): boolean {
  const type = normCode(deliveryType)
  return type === 'P' || type === 'PICKINSTORE'
}

/** Where a list row stands now: its Status column word's key (spec 380 L10). */
export function rowTimelineNow(row: DeliveryDocumentModel): TimelineStepKey {
  return timelineNow(timeline(timelineInputFromRow(row))).key
}

/**
 * Where a document header stands now: Delivery details' now-step badge (spec 380 D2, ticket
 * 402). The same derivation as `rowTimelineNow`, so the badge and the list's Status word agree
 * on the same delivery.
 */
export function headerTimelineNow(doc: SdDocumentHeaderModel): TimelineStepKey {
  return timelineNow(timeline(timelineInputFromHeader(doc))).key
}

/**
 * The list row's input (the inspector variant). Times come from the row's own fields only:
 * Created ← `entryTime`, Out ← `outForDeliveryTime`, Delivered ← `actualDeliveryTime`. The
 * rewind marker comes from `rescheduled` / `rescheduledTime`. The next step's expectation is
 * the row's `deliveryWindow()`.
 */
export function timelineInputFromRow(row: DeliveryDocumentModel): TimelineInput {
  return {
    pickInStore: isPickInStore(row.deliveryType),
    readyStatus: row.readyStatus,
    deliveryStatus: row.deliveryStatus,
    closeStatus: row.closeStatus,
    times: {
      created: row.entryTime,
      out: row.outForDeliveryTime,
      delivered: row.actualDeliveryTime,
    },
    rewind: row.rescheduled === true ? { kind: 'rescheduled', time: realTime(row.rescheduledTime) } : null,
    slotWindow: deliveryWindow(row),
  }
}

const REWIND_ACTIONS: Record<string, RewindKind> = {
  DRBK: 'returned',
  DRSC: 'rescheduled',
  DCHC: 'courierChanged',
}

/**
 * The document header's input (the Details variant). The rewind is named by `lastAction`.
 * It carries no times yet — so no marker shows either: on Details a time is the latest
 * matching Log row's, and S4 (402–403) extends this input with the Log.
 */
export function timelineInputFromHeader(doc: SdDocumentHeaderModel): TimelineInput {
  const status = doc.status
  const rewind = REWIND_ACTIONS[normCode(status?.lastAction)]
  return {
    pickInStore: isPickInStore(doc.deliveryType),
    readyStatus: status?.readyStatus ?? '',
    deliveryStatus: status?.deliveryStatus ?? '',
    closeStatus: status?.closeStatus ?? '',
    times: {},
    rewind: rewind ? { kind: rewind, time: null } : null,
    slotWindow: deliveryWindow(doc),
  }
}

/**
 * The due/paid tag (369 §1): payment is not a step. `Due 72.50` while something is left to
 * pay, `Paid` otherwise. `amount` is the formatted money; the surface supplies the words. A
 * due that rounds to 0.00 is paid.
 */
export function dueTag(amountDue: number | null | undefined): { paid: true } | { paid: false; amount: string } {
  const due = typeof amountDue === 'number' && Number.isFinite(amountDue) ? amountDue : 0
  return Math.round(due * 100) > 0 ? { paid: false, amount: formatMoney(due) } : { paid: true }
}
