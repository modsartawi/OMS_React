/**
 * Force refund's pure rules (spec 759 F5, ticket 763; BackOffice 3369 D13, door 3375).
 *
 * A privileged operator (grant 04, counted only beside 03) states what actually arrived per line
 * and why; the server pays. Free of React so the clamp, the gate, the body and the offer are plain
 * data — and so the one place money could creep onto the wire is a tested function.
 */
import type { ForceLfReturnRefundRequest, LfReturnDetailModel } from '@/core/models/lf-return'

/** One line the operator states a received quantity for. */
export interface ForceRefundRow {
  itemNumber: string
  sku: string
  /** What was asked — the received quantity's cap. `0` when the server did not send it. */
  asked: number
}

/** Received quantities by item number; a line absent here is not yet stated. */
export type ReceivedByItem = Readonly<Record<string, number | null | undefined>>

function finiteCap(asked: number | null | undefined): number {
  return typeof asked === 'number' && Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 0
}

/**
 * Hold a received quantity inside `[0, asked]`. Unlike the return dialog's `[1, remaining]`, **0 is
 * a real answer** — nothing arrived. A fractional value takes its whole part: a part of a pack that
 * was not received is never paid for. A blank box (or anything that is not a number) is `null` —
 * *not stated* — because the operator states every line and a guessed `0` would be a statement they
 * never made. An ask the server did not send caps at `0`: nothing is paid for an unknown ask.
 */
export function clampReceivedQuantity(value: unknown, asked: number | null | undefined): number | null {
  const text = typeof value === 'number' ? null : String(value ?? '').trim()
  if (text === '') return null
  const typed = typeof value === 'number' ? value : Number(text)
  if (!Number.isFinite(typed)) return null
  return Math.min(Math.max(Math.trunc(typed), 0), finiteCap(asked))
}

/** The dialog's rows: one per watch line, in the watch's order, nothing typed. */
export function forceRefundLines(detail: LfReturnDetailModel): ForceRefundRow[] {
  return (detail.lines ?? []).map((l) => ({
    itemNumber: (l.itemNumber ?? '').trim(),
    sku: (l.sku ?? '').trim(),
    asked: finiteCap(l.askedQuantity),
  }))
}

export type ForceRefundGateKey =
  | 'lfReturn.force.gate.noLines'
  | 'lfReturn.force.gate.stateEveryLine'
  | 'lfReturn.force.gate.reasonRequired'
  | 'lfReturn.force.gate.ready'

export interface ForceRefundGate {
  ok: boolean
  key: ForceRefundGateKey
  params?: { count: number }
}

const stated = (received: ReceivedByItem, row: ForceRefundRow): boolean => typeof received[row.itemNumber] === 'number'

/**
 * The submit gate — one missing thing at a time, in the order the operator acts: every line stated
 * (a `0` counts, a blank does not), then a reason. Ready flips to a plain summary.
 */
export function forceRefundGate(rows: readonly ForceRefundRow[], received: ReceivedByItem, reason: string): ForceRefundGate {
  if (rows.length === 0) return { ok: false, key: 'lfReturn.force.gate.noLines' }
  const unstated = rows.filter((row) => !stated(received, row)).length
  if (unstated > 0) return { ok: false, key: 'lfReturn.force.gate.stateEveryLine', params: { count: unstated } }
  if (reason.trim() === '') return { ok: false, key: 'lfReturn.force.gate.reasonRequired' }
  return { ok: true, key: 'lfReturn.force.gate.ready', params: { count: rows.length } }
}

export interface ForceRefundDraft {
  returnDeliveryNo: string
  rows: readonly ForceRefundRow[]
  received: ReceivedByItem
  reason: string
  requestId: string
}

/**
 * The 3375 body. Quantities are re-clamped on the way out, so nothing typed reaches the wire above
 * asked. ⚠ **No amount, ever** — the server computes the refund; the whole-body walk test guards it.
 * Call only behind an `ok` gate: an unstated line would go out as `0`.
 */
export function buildForceRefundRequest(draft: ForceRefundDraft): ForceLfReturnRefundRequest {
  return {
    returnDeliveryNo: draft.returnDeliveryNo,
    lines: draft.rows.map((row) => ({
      itemNumber: row.itemNumber,
      receivedQuantity: clampReceivedQuantity(draft.received[row.itemNumber], row.asked) ?? 0,
    })),
    reason: draft.reason.trim(),
    requestId: draft.requestId,
  }
}

/**
 * The idempotency key for a press. A press with an id still **held** — the last press was never
 * answered (in flight, a network drop, a 5xx) — reuses it, so a slow network forces once. Otherwise
 * a fresh one is minted. The dialog drops the held id once the server answers (success or refusal)
 * and on every opening.
 */
export function pressRequestId(held: string | null, mint: () => string): string {
  return held ?? mint()
}

export type ForceRefundAction =
  | { shown: false }
  | { shown: true; disabled: false }
  | { shown: true; disabled: true; reasonKey: string }

/** The outcomes a force can still settle — open, or stuck (3369's needing-action set). */
const FORCEABLE = ['open', 'unanswered', 'short', 'nothingReceived']
/** Already settled: 3375 refuses both. */
const SETTLED = ['refunded', 'forced']

/**
 * Whether Force refund is offered (spec 759 F5). Absent without 04 (the caller passes the access
 * model's `canForceLocalFulfillmentReturnRefund`, already counted only beside 03). Disabled with its
 * reason on `refunded` / `forced`, and on an outcome this client has not learned — money is not
 * released on a guess.
 */
export function forceRefundAction(canForce: boolean | undefined, outcome: string | null | undefined): ForceRefundAction {
  if (canForce !== true) return { shown: false }
  const code = (outcome ?? '').trim()
  if (FORCEABLE.includes(code)) return { shown: true, disabled: false }
  if (SETTLED.includes(code)) return { shown: true, disabled: true, reasonKey: `lfReturn.force.disabled.${code}` }
  return { shown: true, disabled: true, reasonKey: 'lfReturn.force.disabled.unknown' }
}
