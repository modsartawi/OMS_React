/**
 * The 30-day simulation's view model (ticket 739, spec 734 D15/D19/D20). Pure, pinned by
 * `summary-model.test.ts`: it turns the D20 `SourcingAdvisor/Summary` reply into what the page draws.
 *
 * 🚩 The door sums the scored rows (D19); nothing here recomputes a saving. What lives here:
 * - the figures as sent (a count that is not a number reads absent); SAR shown to the halala;
 * - the share of orders with a saving, shown only when `orders > 0` (one decimal, a display ratio);
 * - an absent breakdown or top list reads as empty, so a bare reply draws an empty page;
 * - a top order's stores as `code · name` pairs and its reasons as i18n keys, through 738's own
 *   `storePair` and `reasonKey` (`./explain-model`) — never forked;
 * - "scored through", only when the range runs past the last day the nightly job scored.
 */
import { apiErrorCode, apiErrorData } from '@/core/api'
import type { SourcingSummaryBreakdownRow, SourcingSummaryReply, SourcingTopOrder } from '@/core/models/sourcing-advisor'
import { money, reasonKey, storePair, type ReasonLine } from './explain-model'

export interface SummaryHeadline {
  orders: number | null
  ordersWithSaving: number | null
  /** Percent, one decimal; `null` when there are no orders. */
  share: number | null
  totalSaving: string | null
  avgSaving: string | null
}

/** A breakdown row: numbers kept as numbers so the grid sorts them; SAR is formatted by the column. */
export interface BreakdownRow {
  key: string
  orders: number | null
  ordersWithSaving: number | null
  share: number | null
  totalSaving: number | null
  avgSaving: number | null
}

export interface TopRow {
  /** The grid's row id: the position plus the order number, so a blank or repeated number stays unique. */
  rowId: string
  orderNo: string
  actualStore: string
  bestStore: string
  saving: number | null
  reasons: ReasonLine[]
}

export interface SummaryModel {
  headline: SummaryHeadline
  byCity: BreakdownRow[]
  byChannel: BreakdownRow[]
  byDeliveryType: BreakdownRow[]
  top: TopRow[]
  rateVersion: string
  placeholderRates: boolean
  /** The last scored day when the range runs past it, else `null`. */
  scoredThrough: string | null
}

/** D20: up to 50 top orders. */
export const MAX_TOP = 50

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function share(orders: number | null, withSaving: number | null): number | null {
  if (orders === null || withSaving === null || orders <= 0) return null
  return Math.round((withSaving / orders) * 1000) / 10
}

function breakdown(rows: SourcingSummaryBreakdownRow[] | null | undefined): BreakdownRow[] {
  return (rows ?? []).map((r) => {
    const orders = num(r.orders)
    const ordersWithSaving = num(r.ordersWithSaving)
    return {
      key: (r.key ?? '').trim(),
      orders,
      ordersWithSaving,
      share: share(orders, ordersWithSaving),
      totalSaving: num(r.totalSaving),
      avgSaving: num(r.avgSaving),
    }
  })
}

function top(o: SourcingTopOrder, i: number): TopRow {
  const orderNo = (o.orderNo ?? '').trim()
  return {
    rowId: `${i}:${orderNo}`,
    orderNo,
    actualStore: storePair(o.actualStore, o.actualStoreName),
    bestStore: storePair(o.bestStore, o.bestStoreName),
    saving: num(o.saving),
    reasons: (o.reasons ?? []).map((code) => ({ code, key: reasonKey(code) })),
  }
}

/** `rangeTo` is the last day asked: "scored through" shows only when the job stopped short of it. */
export function summaryModel(reply: Partial<SourcingSummaryReply> | null | undefined, rangeTo: string): SummaryModel {
  const r = reply ?? {}
  const orders = num(r.orders)
  const ordersWithSaving = num(r.ordersWithSaving)
  const scored = (r.scoredThrough ?? '').trim()
  return {
    headline: {
      orders,
      ordersWithSaving,
      share: share(orders, ordersWithSaving),
      totalSaving: money(r.totalSaving),
      avgSaving: money(r.avgSaving),
    },
    byCity: breakdown(r.byCity),
    byChannel: breakdown(r.byChannel),
    byDeliveryType: breakdown(r.byDeliveryType),
    top: (r.top ?? []).slice(0, MAX_TOP).map((o, i) => top(o, i)),
    rateVersion: r.rateVersion ?? '',
    placeholderRates: r.placeholderRates === true,
    // `yyyy-MM-dd` compares as text.
    scoredThrough: scored !== '' && scored < rangeTo ? scored : null,
  }
}

/**
 * A `SOURCING-404` refusal's last scored day (from its `data.scoredThrough`; `''` when it carried
 * none), or `null` when the failure is anything else.
 */
export function refusedScoredThrough(err: unknown): string | null {
  if (apiErrorCode(err) !== 'SOURCING-404') return null
  const data = apiErrorData(err) as { scoredThrough?: unknown } | null
  return typeof data?.scoredThrough === 'string' ? data.scoredThrough.trim() : ''
}
