import type { Severity } from '@/core/ui/severity'
import type { DeliverectOrderOutcome } from '@/core/models/deliverect'

// The words and tones of a Deliverect order (spec 2615 "Order processing", ticket 478). Pure: no
// React, no `t` — each function hands back a KEY in `deliverect-orders`, the page translates it.

/**
 * The status codes we send Deliverect (spec 2615's status table; contract § Orders monitor):
 * 20 Accepted, 90 Finalized, 110 Cancelled, 120 Failed, 126 Cancel failed.
 */
export const ORDER_STATUS = {
  accepted: 20,
  finalized: 90,
  cancelled: 110,
  failed: 120,
  cancelFailed: 126,
} as const

type StatusName = keyof typeof ORDER_STATUS

const STATUS_SEV: Record<StatusName, Severity> = {
  accepted: 'ok',
  finalized: 'ok',
  cancelled: 'mute',
  failed: 'bad',
  cancelFailed: 'bad',
}

const BY_CODE = new Map<number, StatusName>(Object.entries(ORDER_STATUS).map(([name, code]) => [code, name as StatusName]))

/** A status code in words: `key` names its label, or is `null` for a code the contract does not
 *  name — the page then shows the raw number, neutral. */
export interface StatusLabel {
  key: string | null
  code: number
  sev: Severity
}

export function statusLabel(code: number): StatusLabel {
  const name = BY_CODE.get(code)
  return name ? { key: `statuses.${name}`, code, sev: STATUS_SEV[name] } : { key: null, code, sev: 'mute' }
}

/**
 * A cancel that arrived after the store had invoiced (126): we told Deliverect we could not cancel,
 * so the platform and our document disagree — it needs a person (spec 2615: "126 + monitor alert").
 */
export function needsPerson(lastStatusSent: number | null | undefined): boolean {
  return lastStatusSent === ORDER_STATUS.cancelFailed
}

const OUTCOME_SEV: Record<DeliverectOrderOutcome, Severity> = {
  created: 'ok',
  refused: 'bad',
  droppedLines: 'warn',
  cancelled: 'mute',
  statusFailed: 'bad',
}

/** An outcome in words; an outcome the contract does not name is shown raw, neutral. */
export function outcomeLabel(outcome: string): { key: string | null; sev: Severity } {
  return Object.hasOwn(OUTCOME_SEV, outcome)
    ? { key: `outcomes.${outcome}`, sev: OUTCOME_SEV[outcome as DeliverectOrderOutcome] }
    : { key: null, sev: 'mute' }
}

/**
 * Retry is offered for the two failed outcomes ONLY: `refused` (re-run the order) and
 * `statusFailed` (re-send the failed status call). Anything else the door refuses with DLV-00007.
 */
export function retryOffered(outcome: string): boolean {
  return outcome === 'refused' || outcome === 'statusFailed'
}

/** The document page our document number opens. */
export function documentPath(documentNumber: string): string {
  return `/oms/document/${encodeURIComponent(documentNumber)}`
}
