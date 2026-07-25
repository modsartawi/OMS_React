import type { SimulateRequest } from '@/core/models/simulation'

/**
 * The staleness predicate (ticket 114, spec 110) — do the inputs on screen still
 * describe the result on screen?
 *
 * It is a **pure module**, not a rule inlined in the strip, for two reasons: a
 * node-environment runner can reach it, and the trap it has to defend against is
 * a data trap rather than a rendering one.
 *
 * **The trap is the false positive.** `''`, `null`, `undefined` and an absent key
 * are four spellings of the same "not set" on an optional field, and the Page
 * rebuilds the request object on every render. A naive `JSON.stringify` compare
 * would therefore mark a run stale the instant it returned — and a mark that is
 * always on stops meaning anything. So both sides are **normalised to a
 * canonical shape first**: optional strings collapse to `''`, an absent or empty
 * `manualConditions` collapses to `[]`, and every field is written in a fixed key
 * order so the comparison never depends on how the object was built.
 *
 * **Row order is significant.** The server assigns `itemNumber` by array position
 * ((index+1)*10, contract 486), so two otherwise-equal rows swapped ARE a
 * different basket — rows normalise in place, they are never sorted.
 *
 * It **marks only**: nothing here re-runs, blocks a Process or discards a result.
 */

/** Every spelling of "not set" collapsed to one, and surrounding space dropped —
 *  trimming is not an edit, and the request builder trims anyway. */
function text(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/** The request as a canonical string: fixed key order, absences collapsed. */
function canonical(request: SimulateRequest): string {
  const { header } = request
  return JSON.stringify({
    header: [
      text(header.plant),
      text(header.salesOrganization),
      text(header.distributionChannel),
      text(header.pricingDate),
      text(header.documentPricingProcedureKey),
      text(header.loyGroups),
      text(header.loyTier),
      header.isPromotionApplicable === true,
    ],
    // In array order — position is the item number, so a reorder is a change.
    items: request.items.map((item) => [
      text(item.materialNumber),
      Number(item.quantity) || 0,
      text(item.qtyUnit),
      text(item.itemConditionControl),
    ]),
    // Absent and empty are the same absence: the builder omits the key entirely
    // when no row carries a condition type.
    manualConditions: (request.manualConditions ?? []).map((condition) => [
      Number(condition.itemNumber) || 0,
      text(condition.conditionType),
      Number(condition.rate) || 0,
      text(condition.rateUnit),
    ]),
    includeConditions: request.includeConditions === true,
    includePricingElements: request.includePricingElements === true,
  })
}

/**
 * `true` when the inputs on screen differ from the request that produced the
 * on-screen result. No prior run (`ran === null`) is **not** stale — there is
 * nothing on screen for the mark to be about.
 */
export function isStaleRun(current: SimulateRequest, ran: SimulateRequest | null): boolean {
  if (ran === null) return false
  return canonical(current) !== canonical(ran)
}
