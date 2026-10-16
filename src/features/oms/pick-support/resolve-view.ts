// What the Search tab draws for a lookup's answer, and the tab's URL state (ticket 496, brief
// 2691 "The screens"). Pure: no React, no `t`.

import type { PickSupportResolution, PickSupportResolvedDelivery, PickSupportSerialHold } from '@/core/models/pick-support'

/**
 * - `noMatch` — `matched: false`: the server's own sentence, EN and AR (a 200, not an error);
 * - `diagnosis` — one delivery and no serials: straight to its diagnosis;
 * - `holds` — the key was a serial: the holds table, with the deliveries it names (if any);
 * - `list` — several deliveries (an order): a pick list, each row opening its diagnosis.
 */
export type ResolveView =
  | { kind: 'noMatch'; messageEn: string; messageAr: string }
  | { kind: 'diagnosis'; deliveryNo: string }
  | { kind: 'holds'; holds: PickSupportSerialHold[]; deliveries: PickSupportResolvedDelivery[] }
  | { kind: 'list'; deliveries: PickSupportResolvedDelivery[] }

export function resolveView(r: PickSupportResolution): ResolveView {
  if (!r.matched) return { kind: 'noMatch', messageEn: r.messageEn ?? '', messageAr: r.messageAr ?? '' }
  const deliveries = r.deliveries ?? []
  const serials = r.serials ?? []
  if (serials.length > 0) return { kind: 'holds', holds: serials, deliveries }
  if (deliveries.length === 1) return { kind: 'diagnosis', deliveryNo: deliveries[0].deliveryNo }
  return { kind: 'list', deliveries }
}

/**
 * The deliveries a row of the view may open under it (`?delivery=`): the list's, and the holds'
 * that have one. A one-delivery or no-match answer opens nothing by row.
 */
export function openable(view: ResolveView): string[] {
  if (view.kind === 'list') return view.deliveries.map((d) => d.deliveryNo)
  if (view.kind === 'holds')
    return [...view.deliveries.map((d) => d.deliveryNo), ...view.holds.map((h) => (h.deliveryNo ?? '').trim()).filter(Boolean)]
  return []
}

/**
 * The Search tab's URL state: `?key=` (the number looked up, so a link to a case can be shared)
 * and `?delivery=` (the row of a list or a hold opened under it). Blanks are dropped.
 */
export interface SearchQuery {
  key: string
  delivery: string
}

export function searchFromParams(params: URLSearchParams): SearchQuery {
  return { key: (params.get('key') ?? '').trim(), delivery: (params.get('delivery') ?? '').trim() }
}

export function searchToParams(q: SearchQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.key.trim()) out.set('key', q.key.trim())
  // A delivery opened under a list belongs to that list's key: without a key it means nothing.
  if (q.key.trim() && q.delivery.trim()) out.set('delivery', q.delivery.trim())
  return out
}
