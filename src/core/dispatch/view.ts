import {
  DISTANCE_FALLBACK_REASONS,
  type DispatchBid,
  type DispatchCallout,
  type DistanceFallbackReason,
  type DistanceMeasure,
  type LocalDateTime,
} from '@/core/models/dispatch-board'
import type { Severity } from '@/core/ui/severity'
import { formatNumber } from '@/core/util/number-format'

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

/** What an open callout's line says of its time: time left, due to fall back now, or nothing (no `secondsLeft`). */
export type CalloutClock = { kind: 'left'; left: number } | { kind: 'due' } | { kind: 'none' }

export function calloutClock(secondsLeft: number | null, fetchedAt: number, now: number): CalloutClock {
  const left = countdownLeft(secondsLeft, fetchedAt, now)
  if (left == null) return { kind: 'none' }
  return left === 0 ? { kind: 'due' } : { kind: 'left', left }
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
  /** The km the decision used. */
  km: number
  /** A `SHADOW` callout's measured road km, shown beside `km` (the straight line); absent otherwise (spec 3460). */
  roadKm?: number
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

/**
 * A bid as the inspector row (541) and the ledger row (542) read it. Given its callout's measure, a `SHADOW`
 * callout's bid carries its road km (when measured) so the dispatcher sees the gap to the straight line (858).
 */
export function bidRow(bid: DispatchBid, measure?: DistanceMeasure): BidRowView {
  const moment = (kind: BidMomentKind, at: LocalDateTime | null, staff: string, register: string): BidMoment => ({
    kind,
    at: at ?? null,
    seconds: secondsBetween(bid.offeredAt, at ?? null),
    staff: at ? (staff ?? '') : '',
    register: at ? (register ?? '') : '',
  })
  const road = measure === 'SHADOW' && typeof bid.roadKm === 'number' && bid.roadKm > 0 ? { roadKm: bid.roadKm } : {}
  return {
    bidId: bid.bidId,
    store: bid.store,
    km: bid.distanceKm,
    ...road,
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

/** Removed by duty: the count, or `null` (not shown) at 0 or when the callout predates the duty check. */
export function dutyRemovedView(c: Partial<Pick<DispatchCallout, 'dutyRemovedCount'>>): number | null {
  const n = c.dutyRemovedCount ?? 0
  return n > 0 ? n : null
}

/**
 * How a searched radius was measured (spec 3460, oms 858). A fallback's reason is a known code (`key`, labelled
 * from the locale), an unknown one (`raw`, shown as itself), or `null` when the row carries none.
 */
export type RadiusMeasureView =
  | { kind: 'road' }
  | { kind: 'shadow' }
  | { kind: 'fallback'; reason: { key: DistanceFallbackReason } | { raw: string } | null }

/**
 * The radius behind a callout's result (spec 3326): searched n km, no radius search (`0`), or nothing to show.
 * `measure` and `widened` are present only when the row says so (spec 3460), so an unmeasured callout reads as today.
 */
export type SearchRadiusView =
  | { kind: 'searched'; km: string; measure?: RadiusMeasureView; widened?: true }
  | { kind: 'none' }

export type SearchRadiusInput = Partial<
  Pick<DispatchCallout, 'searchRadiusKm' | 'distanceMeasure' | 'distanceFallbackReason' | 'searchWidened'>
>

const measureView = (c: SearchRadiusInput): RadiusMeasureView | null => {
  switch (c.distanceMeasure) {
    case 'ROAD':
      return { kind: 'road' }
    case 'SHADOW':
      return { kind: 'shadow' }
    case 'STRAIGHT_FALLBACK': {
      const code = (c.distanceFallbackReason ?? '').trim()
      if (!code) return { kind: 'fallback', reason: null }
      const known = (DISTANCE_FALLBACK_REASONS as readonly string[]).includes(code)
      return { kind: 'fallback', reason: known ? { key: code as DistanceFallbackReason } : { raw: code } }
    }
    default:
      return null
  }
}

/**
 * `null` (no label) when the callout predates spec 3326. The normal radius is not sent, so "widened" comes only from
 * the row's own `searchWidened`, never inferred from the km.
 */
export function searchRadiusView(c: SearchRadiusInput): SearchRadiusView | null {
  const km = c.searchRadiusKm
  if (typeof km !== 'number' || !Number.isFinite(km)) return null
  if (km <= 0) return { kind: 'none' }
  const view: SearchRadiusView = { kind: 'searched', km: formatNumber(km) }
  const measure = measureView(c)
  if (measure) view.measure = measure
  if (c.searchWidened === true) view.widened = true
  return view
}
