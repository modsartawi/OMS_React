/**
 * The pitch card's headline (spec 995 D2, ticket 996) — what the caller gets, in one line,
 * built from the offer's `definition` (C2) and never from the author's `description`.
 *
 * - Buy 3, get 1 of the same item at 100% → *Buy 3, get the 4th free* (an ordinal, so the
 *   locale's ordinal plurals say *4th* / *2nd* / *21st*).
 * - Buy 2 at 20% with no get side → *Buy 2, 20% off*.
 * - A value threshold (no `buyQty`) says the discount alone.
 *
 * 🚩 **An unknown shape is not guessed at.** No definition, an unknown `discountType`, no value,
 * or a get side priced by amount or set price falls back to the author's `description` alone,
 * passed through as data (D2).
 *
 * The one figure derived here is the ordinal's POSITION (`buyQty + 1`, the 4th), which is not
 * money. `discountValue` rides through as the definition states it.
 */
import type { OfferDefinition } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'

export type OfferHeadline = { kind: 'phrase'; phrase: GuidancePhrase } | { kind: 'description'; text: string }

const KEY = 'callcenter:offer.headline'

export function offerHeadline(definition: OfferDefinition | null | undefined, description: string): OfferHeadline {
  const phrase = definition ? phraseOf(definition) : null
  return phrase ? { kind: 'phrase', phrase } : { kind: 'description', text: description ?? '' }
}

function phraseOf(definition: OfferDefinition): GuidancePhrase | null {
  const value = positive(definition.discountValue)
  if (value === null) return null
  const type = definition.discountType
  const buy = positive(definition.buyQty)
  const get = positive(definition.getQty)

  if (get !== null) {
    // A get side priced by amount or set price is a shape this console has no words for.
    if (type !== 'percent' || buy === null) return null
    const free = value >= 100
    if (definition.getSameItem === true && get === 1)
      return free
        ? { key: `${KEY}.nthFree`, params: { buy, count: buy + 1, ordinal: true } }
        : { key: `${KEY}.nthPercent`, params: { buy, count: buy + 1, ordinal: true, value } }
    if (free)
      return definition.getSameItem === true
        ? { key: `${KEY}.moreFree`, params: { buy, count: get } }
        : { key: `${KEY}.getFree`, params: { buy, count: get } }
    return { key: `${KEY}.getPercent`, params: { buy, count: get, value } }
  }

  if (type !== 'percent' && type !== 'amount' && type !== 'price') return null
  return buy === null
    ? { key: `${KEY}.${type}Only`, params: { value } }
    : { key: `${KEY}.${type}`, params: { buy, value } }
}

const positive = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
