import type { DispatchBid, LocalDateTime } from '@/core/models/dispatch-board'
import type { Severity } from '@/core/ui/severity'

// A callout's view logic (BackOffice spec 2952, oms ticket 541): the countdown, an outcome's and a bid
// status's label, and a bid row's story. In `@/core/` because the board (541) and the delivery's
// Callout sub-tab ledger (542) draw the same bid row. Pure: no React, no `t` — label KEYS live in the
// `dispatch-board` namespace.

/**
 * Seconds left on an open callout: the door's `secondsLeft` (at `asOf`) less the WHOLE seconds the
 * client clock has moved since the answer arrived (`fetchedAt`, the client's own receipt time, so a
 * server clock ahead or behind never skews it). Never below 0, never above `secondsLeft`; `null` when
 * the callout is not open.
 */
export function countdownLeft(secondsLeft: number | null, fetchedAt: number, now: number): number | null {
  if (secondsLeft == null) return null
  const moved = Math.max(0, Math.floor((now - fetchedAt) / 1000))
  return Math.max(0, secondsLeft - moved)
}

/** Seconds as `m:ss` (minutes are not wrapped into hours: a callout lives minutes). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A label: its key when the value is known, else `null` and the raw value is shown as it came. */
export interface LabelView {
  key: string | null
  sev: Severity
  raw: string
}

const OUTCOME_SEV: Record<string, Severity> = {
  Open: 'go',
  Taken: 'ok',
  FellBack: 'warn',
  Withdrawn: 'mute',
  NotCompeted: 'mute',
}

/** A callout's outcome (`Open | Taken | FellBack | Withdrawn | NotCompeted`). */
export function outcomeView(outcome: string): LabelView {
  return outcome in OUTCOME_SEV
    ? { key: `outcome.${outcome}`, sev: OUTCOME_SEV[outcome], raw: outcome }
    : { key: null, sev: 'mute', raw: outcome }
}

const BID_SEV: Record<string, Severity> = {
  OPEN: 'go',
  TAKEN: 'ok',
  PASSED: 'mute',
  LOST: 'mute',
  EXPIRED: 'warn',
  WITHDRAWN: 'mute',
}

/** A bid's status (`OPEN | TAKEN | PASSED | LOST | EXPIRED | WITHDRAWN`). */
export function bidStatusView(status: string): LabelView {
  return status in BID_SEV
    ? { key: `bidStatus.${status}`, sev: BID_SEV[status], raw: status }
    : { key: null, sev: 'mute', raw: status }
}

/** ATP at offer: covers the basket, short by n lines, or unknown (no stock check, or it failed). */
export type AtpView = { kind: 'covers' } | { kind: 'short'; lines: number } | { kind: 'unknown' }

export function atpView(bid: Pick<DispatchBid, 'atpKnown' | 'atpCoversBasket' | 'atpShortLines'>): AtpView {
  if (!bid.atpKnown) return { kind: 'unknown' }
  return bid.atpCoversBasket ? { kind: 'covers' } : { kind: 'short', lines: bid.atpShortLines }
}

export const BID_MOMENTS = ['delivered', 'shown', 'opened', 'answered'] as const
export type BidMomentKind = (typeof BID_MOMENTS)[number]

/** One of a bid's four moments, with the seconds from offer; `at` / `seconds` `null` when never stamped. */
export interface BidMoment {
  kind: BidMomentKind
  at: LocalDateTime | null
  seconds: number | null
  staff: string
  register: string
}

export interface BidRowView {
  bidId: string
  store: string
  km: number
  atp: AtpView
  tills: { online: number; signedIn: number }
  dark: boolean
  moments: BidMoment[]
  status: LabelView
  ignoreReason: string
}

const secondsBetween = (from: LocalDateTime, to: LocalDateTime | null): number | null => {
  if (!to) return null
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((b - a) / 1000)
}

/** A bid as the inspector row (541) and the ledger row (542) read it. */
export function bidRow(bid: DispatchBid): BidRowView {
  const moment = (kind: BidMomentKind, at: LocalDateTime | null, staff: string, register: string): BidMoment => ({
    kind,
    at: at ?? null,
    seconds: secondsBetween(bid.offeredAt, at ?? null),
    staff: at ? (staff ?? '') : '',
    register: at ? (register ?? '') : '',
  })
  return {
    bidId: bid.bidId,
    store: bid.store,
    km: bid.distanceKm,
    atp: atpView(bid),
    tills: { online: bid.onlineTills, signedIn: bid.signedInTills },
    dark: bid.dark,
    moments: [
      moment('delivered', bid.deliveredAt, '', bid.deliveredRegister),
      moment('shown', bid.shownAt, bid.shownStaff, bid.shownRegister),
      moment('opened', bid.openedAt, bid.openedStaff, bid.openedRegister),
      moment('answered', bid.answeredAt, bid.answeredStaff, bid.answeredRegister),
    ],
    status: bidStatusView(bid.status),
    ignoreReason: bid.ignoreReason ?? '',
  }
}
