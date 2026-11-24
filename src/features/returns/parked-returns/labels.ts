/**
 * The words a parked return and its grains wear (BackOffice ticket 4224, spec 4212 stories 9-11, 29): each is a key in the
 * `parked-returns` namespace and a badge severity. The server sends codes (BackOffice 4218's enums); a code the screen does
 * not know reads as "unknown", never as the raw code.
 */
import type { LedgerStatus, NeedsHqReason, ParkedReturnRow, ParkedReturnGrain, ParkedReturnState, ParkReason } from '@/core/models/parked-returns'
import type { Severity } from '@/core/ui/severity'
import { isBlankDate } from '@/core/util/date-format'

export interface Label {
  key: string
  sev: Severity
}

const STATE: Record<ParkedReturnState, Label> = {
  NEEDS_HQ: { key: 'state.needsHq', sev: 'warn' },
  WAITING_FOR_PARTNER: { key: 'state.waitingForPartner', sev: 'go' },
  WAITING_FOR_STORE: { key: 'state.waitingForStore', sev: 'go' },
  FINISHED: { key: 'state.finished', sev: 'mute' },
}
export const STATES = Object.keys(STATE) as ParkedReturnState[]

const LEDGER: Record<LedgerStatus, Label> = {
  PENDING: { key: 'ledger.pending', sev: 'go' },
  SUBMITTED: { key: 'ledger.submitted', sev: 'go' },
  REFUNDED: { key: 'ledger.refunded', sev: 'ok' },
  FAILED: { key: 'ledger.failed', sev: 'bad' },
}

const REASON: Record<NeedsHqReason, string> = {
  NO_STATUS_API: 'reason.noStatusApi',
  ESCALATED: 'reason.escalated',
  AGED: 'reason.aged',
  UNCHECKED_FAILURE: 'reason.uncheckedFailure',
  MIXED: 'reason.mixed',
  ROWLESS: 'reason.rowless',
}
export const NEEDS_HQ_REASONS = Object.keys(REASON) as NeedsHqReason[]

const PARK_REASON: Record<ParkReason, string> = {
  AMBIGUOUS_ANSWER: 'parkReason.ambiguousAnswer',
  HELD_AT_COMPLETION: 'parkReason.heldAtCompletion',
}
export const PARK_REASONS = Object.keys(PARK_REASON) as ParkReason[]

const own = <T extends object>(map: T, code: string): code is Extract<keyof T, string> => Object.prototype.hasOwnProperty.call(map, code)

/** A return's state in words. */
export const stateLabel = (state: string): Label => (own(STATE, state) ? STATE[state] : { key: 'state.unknown', sev: 'mute' })

/** A grain's ledger status in words. */
export const ledgerLabel = (status: string): Label => (own(LEDGER, status) ? LEDGER[status] : { key: 'ledger.unknown', sev: 'mute' })

/** Why a return needs HQ, in words. */
export const needsHqReasonLabel = (reason: string): string => (own(REASON, reason) ? REASON[reason] : 'reason.unknown')

/** Why the return parked, in words (blank or new = unknown). */
export const parkReasonLabel = (reason: string): string => (own(PARK_REASON, reason) ? PARK_REASON[reason] : 'parkReason.unknown')

/** A list row's badges: its state, then "store details not received" on a ledger row the store never mirrored. */
export function rowBadges(row: Pick<ParkedReturnRow, 'state' | 'storeDetailsReceived'>): Label[] {
  const out = [stateLabel(row.state)]
  if (!row.storeDetailsReceived) out.push({ key: 'badge.storeDetailsNotReceived', sev: 'warn' })
  return out
}

/** A grain's badges: its ledger status, then awaiting HQ, escalated and cash-ruled as they apply. */
export function grainBadges(grain: Pick<ParkedReturnGrain, 'status' | 'awaitingHq' | 'cashRuled' | 'escalated'>): Label[] {
  const out = [ledgerLabel(grain.status)]
  if (grain.awaitingHq) out.push({ key: 'badge.awaitingHq', sev: 'warn' })
  if (grain.escalated) out.push({ key: 'badge.escalated', sev: 'bad' })
  if (grain.cashRuled) out.push({ key: 'badge.cashRuled', sev: 'ok' })
  return out
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days since the return parked, on the local wall clock (the server stamps local time; no-utc-time). Null when there
 * is no park time (blank or the .NET default); a park time ahead of this clock is 0, never negative.
 */
export function ageDays(parkedAt: string, now: Date): number | null {
  if (!parkedAt) return null
  const at = new Date(parkedAt)
  if (isBlankDate(at)) return null
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY_MS))
}
