/**
 * One offer's qualifying items, as the card draws them (ticket 172) — the
 * on-demand half of the guidance surface (`ResolvePrereq`, CONTRACT.md §3.3).
 *
 * Two rulings live here rather than in the card:
 *
 * 1. 🚩 **The handful is the SERVER's `topN`, never a client slice.** 138
 *    finding 1 is the reason the number matters at all: at five, opening one
 *    offer pushed every other offer below the fold, and *three classes in one
 *    list* survives right up until the agent uses the feature. Three is the
 *    ruling — and it is the server's, because a client slice of a server ranking
 *    is a second opinion about which three are worth showing. So nothing here
 *    trims `items`; what it does instead is make the count **legible** to the
 *    drive and to a reviewer.
 * 2. 🚩 **A qualifying row is the SEARCH row.** Same shape, same meta line, same
 *    estimate-off-the-money-column rule (`item-search.ts`, ticket 168) — mapped
 *    rather than re-derived, because a second row model is a second chance for a
 *    price to land in the wrong place. The Arabic name rides the meta line
 *    beside the item number and the estimate, which is what made 138's Arabic
 *    ruling cost zero pixels.
 *
 * The two projections do not agree on field names (`itemNumber` here,
 * `materialNumber` there — §3.3 vs 799), so the mapping is explicit. Nothing
 * here ranks, filters or re-prices: all three are the server's, at the order's
 * plant.
 */
import type { ItemSearchRow, PrereqResolution } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'
import { searchRowView, type SearchRowView } from './item-search'

/** The offer's items, in the server's own ranking, whole. */
export function prereqRows(resolution: PrereqResolution | null | undefined): SearchRowView[] {
  return (resolution?.items ?? []).map((item) =>
    searchRowView({
      materialNumber: item.itemNumber,
      descriptionEn: item.description,
      descriptionAr: item.description2 ?? null,
      estimatePriceExVat: item.estimatePriceExVat ?? null,
      atp: item.atp ?? null,
    } satisfies ItemSearchRow),
  )
}

/**
 * *Search the other 994* — the route to the rest of the set, as a phrase or as
 * nothing at all.
 *
 * 🚩 **A hand-off, not a second list.** The console already has an item search;
 * a modal here would be the second screen 138 ruled out, and a set of 997 is
 * exactly the case where a card must stop trying to be a list.
 *
 * 🚩 **`truncated` is what says there IS a rest** — not the arithmetic. The
 * resolution is availability-filtered (§3.3: *rows with no availability are not
 * returned*), so `eligibleCount: 42` against three rows does not mean 39 unseen
 * items are waiting: on a `truncated: false` answer the server returned
 * everything it had to give, and a route promising the other 39 would send the
 * agent looking for rows it deliberately withheld.
 *
 * `eligibleCount` supplies the FIGURE where the wire stated one — the honest
 * count of what the agent has not seen. Where it did not, the route is offered
 * without a figure rather than with an invented one.
 */
export function restOfSet(
  resolution: PrereqResolution | null | undefined,
  eligibleCount: number | null | undefined,
): GuidancePhrase | null {
  if (!resolution?.truncated) return null
  const shown = resolution.items?.length ?? 0
  const population =
    typeof eligibleCount === 'number' && Number.isFinite(eligibleCount) ? eligibleCount : null
  const rest = population === null ? 0 : population - shown
  return rest > 0
    ? { key: 'callcenter:guidance.searchRest', params: { count: rest } }
    : { key: 'callcenter:guidance.searchRestUnknown', params: {} }
}
