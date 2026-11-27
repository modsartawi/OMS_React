/**
 * The Say lines of the pitch card and the applied card (spec 995 D7, ticket 996) — sentences the
 * agent reads out, as i18n keys (`callcenter:offer.say.*`) filled from server facts only.
 *
 * - The add: *Take 3 more and you get 1 of them free.* (the missing quantity, `offer-strip.ts`).
 * - *It's only for phone orders.* — only when the offer is channel-only (the badge is there).
 * - *It ends on Thursday 3 December.* — only within 14 days (the badge is there). The `date` param
 *   is the day as the badge carries it; the render tier formats it in each language it says it in.
 *
 * The Arabic is its own sentence per key in `locales/ar`, not English word order.
 *
 * 🚩 No money on the pitch (D5). The applied sentence names the engine's amount and the line's
 * own total, both formatted server figures handed in as strings: nothing is summed here.
 */
import type { GuidancePhrase } from './guidance-view'
import type { OfferBadge } from './offer-badges'
import type { OfferAddQty } from './offer-strip'

const KEY = 'callcenter:offer.say'

export function pitchSay({
  description,
  add,
  badges,
  bundleItem = null,
}: {
  description: string
  add: OfferAddQty | null
  badges: OfferBadge[]
  /** BackOffice 4462 — a bundle's missing item, by name: *add X as well and the offer applies*. */
  bundleItem?: string | null
}): GuidancePhrase[] {
  const phrases: GuidancePhrase[] = [
    bundleItem
      ? { key: `${KEY}.bundleAdd`, params: { item: bundleItem, offer: description } }
      : add === null
      ? { key: `${KEY}.pitch`, params: { offer: description } }
      : add.free > 0
        ? { key: `${KEY}.addFree`, params: { count: add.qty, free: add.free } }
        : { key: `${KEY}.add`, params: { count: add.qty, offer: description } },
  ]
  if (badges.some((badge) => badge.kind === 'phoneOnly')) phrases.push({ key: `${KEY}.phoneOnly`, params: {} })
  const ends = badges.find((badge) => badge.kind === 'ends')
  if (ends) phrases.push({ key: `${KEY}.ends`, params: { date: ends.date } })
  return phrases
}

/**
 * Card D's sentence. With no single line to name (`landed: null`) it says nothing here, and the
 * card keeps 987's sentence about the lines.
 */
export function appliedSay({
  amount,
  currency,
  landed,
  keepAll,
}: {
  /** The engine's amount, formatted, without its sign. */
  amount: string
  currency: string
  /** The one line it landed on: its quantity and its own `lineTotal.gross`, formatted. */
  landed: { qty: number; after: string } | null
  /** The offer gives a free unit: removing one takes it away. */
  keepAll: boolean
}): GuidancePhrase[] {
  if (!landed) return []
  return [
    { key: `${KEY}.saved`, params: { amount, currency, after: landed.after, count: landed.qty } },
    ...(keepAll ? [{ key: `${KEY}.keepAll`, params: { count: landed.qty } }] : []),
  ]
}
