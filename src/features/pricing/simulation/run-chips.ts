import { formatShortDate } from '@/core/util/date-format'
import type { SimulateRequest } from '@/core/models/simulation'
import { originSeat, type SimSeat } from './seat'

/**
 * The run strip's chip set (ticket 113, spec 110 — vocabulary ruled in 100, drawn
 * in 102): the determination a run actually used, collapsed into a row of chips.
 *
 * It maps the request to **tokens, not translated strings** — the strip resolves
 * `key` through `strip.key.*` and the promotion flag through the whole keys
 * `strip.promoOn` / `strip.promoOff`. That is what keeps this module node-testable
 * and keeps the zero-literal rule intact (a pure module cannot hold `t()`).
 *
 * The rules, all from 100 §4:
 *
 * - **Determination fields chip always, even at their defaults** — 098 finding 8:
 *   an invalid plant prices silently, so the determination must be readable
 *   without expanding anything. A strip that says nothing because everything is
 *   ordinary cannot distinguish "ordinary" from "not shown".
 * - **Levers and flags chip only when set** — blank ⇒ *no chip*, never a muted one.
 * - **The promotion flag chips in both states** — 098 finding 3: promo-off blacks
 *   out the whole promotions rail, and a blacked-out rail must never read as
 *   "nothing fired".
 * - **The date chip carries no key** — a formatted date reads alone.
 *
 * Six chips ordinarily, nine with the levers, ten with the elements flag — the
 * seat (ticket 957) is a determination field, chipped beside the plant always.
 */

/** The uppercase key tokens, each resolving to a `strip.key.*` value. */
export type RunChipKey = 'plant' | 'org' | 'chan' | 'proc' | 'loy' | 'tier' | 'elem' | 'unact'

export type RunChip =
  /** A bounded code behind a tiny uppercase key — `PLANT P001`. */
  | { kind: 'keyed'; key: RunChipKey; value: string }
  /**
   * The seat (ticket 957, spec 4190) — named, since the seat is not a code, with the origin it
   * sent (`null` for a store till, whose origin is the plant).
   */
  | { kind: 'seat'; seat: SimSeat; origin: string | null }
  /** The pricing-date, formatted; it reads alone, so it carries no key. */
  | { kind: 'date'; value: string }
  /** The promotion flag, one authored phrase per state (the state is not a code). */
  | { kind: 'promo'; on: boolean }
  /** A flag whose presence IS its state — chipped only when on, so no value slot. */
  | { kind: 'flag'; key: 'elem' | 'unact' }

/** A lever's value, or null when every spelling of "unset" says it is not set. */
function lever(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export function runChips(request: SimulateRequest): RunChip[] {
  const { header } = request
  const chips: RunChip[] = [
    { kind: 'keyed', key: 'plant', value: header.plant.trim() },
    {
      kind: 'seat',
      seat: originSeat(header.origin, header.plant),
      origin: (header.origin ?? '').trim() || null,
    },
    { kind: 'keyed', key: 'org', value: header.salesOrganization.trim() },
    { kind: 'keyed', key: 'chan', value: header.distributionChannel.trim() },
  ]

  // A blank pricing date is the ABSENCE of a determination (the engine prices at
  // "now"), not a default — and a bare chip with no text would render as an empty
  // pill, which is the muted-placeholder shape 100 §4 forbids.
  const date = formatShortDate(header.pricingDate)
  if (date !== '') chips.push({ kind: 'date', value: date })

  chips.push({ kind: 'promo', on: header.isPromotionApplicable })

  const proc = lever(header.documentPricingProcedureKey)
  if (proc) chips.push({ kind: 'keyed', key: 'proc', value: proc })
  const loy = lever(header.loyGroups?.join(','))
  if (loy) chips.push({ kind: 'keyed', key: 'loy', value: loy })
  const tier = lever(header.loyTier)
  if (tier) chips.push({ kind: 'keyed', key: 'tier', value: tier })

  if (header.skipBonusBuyActivationCheck) chips.push({ kind: 'flag', key: 'unact' })
  if (request.includePricingElements) chips.push({ kind: 'flag', key: 'elem' })

  return chips
}
