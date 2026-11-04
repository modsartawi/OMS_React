/**
 * "LF returns needing action" (ticket 764, spec 759 F6): the queue's pure reading. Pure: no React,
 * no i18n — a reason is returned as its key's last segment (`deliveries:lfReturns.reason.<key>`).
 */
import type { LfReturnNeedingActionRow } from '@/core/models/lf-returns-needing-action'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { canCreateLocalFulfillmentReturn } from '@/core/oms/access'
import { needsAction, normaliseLfReturnOutcome, type NeedingActionOutcome } from '@/core/oms/lf-return-outcome'

/**
 * Whether the list offers the queue (spec 759 F1/F6): `LocalFulfillmentReturn,03`, read from the
 * probe and never inferred. The server re-checks the read; this only hides what it would refuse.
 */
export const offersLfReturnsQueue = (access: OmsAccessResult | null | undefined): boolean =>
  canCreateLocalFulfillmentReturn(access)

/** Why an LF return needs an operator: the three outcomes 3369's needing-action read returns. */
export type NeedingActionReason = NeedingActionOutcome

/**
 * The reason an outcome needs action, or `null` for one that does not (`open`, `refunded`, `forced`)
 * or one the client has not learned — such a row is not listed rather than listed with no reason.
 * Either spelling of *nothing received* reads the same (`normaliseLfReturnOutcome`).
 */
export function needingActionReason(outcome: string | null | undefined): NeedingActionReason | null {
  const code = normaliseLfReturnOutcome(outcome)
  return needsAction(code) ? code : null
}

/** One row of the queue as the grid shows it. */
export interface NeedingActionView {
  returnDeliveryNo: string
  forwardDeliveryNo: string
  reason: NeedingActionReason
  bookedAt: string | null
  /** Whole local days since `bookedAt`; `null` when the server sent none. */
  ageDays: number | null
}

/** The queue's rows: the needing ones, in the server's order (newest first), with reason and age. */
export function needingActionRows(
  rows: readonly LfReturnNeedingActionRow[] | null | undefined,
  now: Date,
): NeedingActionView[] {
  const listed: NeedingActionView[] = []
  for (const row of rows ?? []) {
    const reason = needingActionReason(row.outcome)
    if (!reason) continue
    listed.push({
      returnDeliveryNo: row.returnDeliveryNo,
      forwardDeliveryNo: row.forwardDeliveryNo,
      reason,
      bookedAt: row.bookedAt ?? null,
      ageDays: ageInDays(row.bookedAt, now),
    })
  }
  return listed
}

/** Midnight of a local calendar day, as a day number free of DST's 23- and 25-hour days. */
function localDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
}

/**
 * Whole local calendar days from `bookedAt` to `now`: 0 on the booking day, 1 from the next local
 * midnight. `bookedAt` is local wall-clock with no offset, which `Date` reads as local. `null` when
 * it is missing or unreadable; a booking stamped after `now` (clock skew) reads 0, never negative.
 */
export function ageInDays(bookedAt: string | null | undefined, now: Date): number | null {
  if (!bookedAt) return null
  const booked = new Date(bookedAt)
  if (Number.isNaN(booked.getTime())) return null
  return Math.max(0, localDay(now) - localDay(booked))
}
