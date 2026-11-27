/**
 * The offer sheet's model (spec 995 B, ticket 997) — the what-if read it makes, and the figures it
 * may draw.
 *
 * - **The read** (D5): `OfferWhatIf`, keyed by transaction, offer and basket `version`, and enabled
 *   only while the sheet is open on an addressable offer. A closed card asks nothing; a basket
 *   change is a new key, so the open sheet re-reads it once.
 * - **The figures**: until the read answers, and when it fails, the sheet shows the DEFINITION
 *   (*100% off 1*). Once it answers, the engine's own `saving` (its size: the wire's is negative),
 *   `unitAfter` and payable before and after, verbatim.
 * - **The refusals**, by code: `ITEM_NOT_FOUND` means the offer is no longer a near-miss — the card
 *   is stale, not unpriceable; anything else (`NO_PRICE_AT_PLANT`, `ITEM_NOT_SELLABLE`, a network
 *   failure) is *Couldn't price this right now* and the card stays.
 *
 * 🚩 **No figure is computed here.** `unitAfter` is the server's per-unit price; where it is null
 * (an offer over several items) there is no per-unit figure, because the client never divides.
 */
import type { FiredPromotion, NearMiss, OfferAudience, OfferDefinition, OfferWhatIf } from '@/core/models/callcenter'
import { offerWhatIfKey } from './api'
import type { GuidancePhrase } from './guidance-view'
import { offerStrip } from './offer-strip'

export { offerEnds } from './offer-badges'

export function whatIfQuery({
  transactionId,
  offerId,
  version,
  open,
}: {
  transactionId: string
  offerId: string
  version: number
  /** The sheet is open on this offer, and it is still a near-miss. */
  open: boolean
}) {
  return {
    queryKey: offerWhatIfKey(transactionId, offerId, version),
    // A blank id (859) cannot be addressed: `buildQuery` would drop it and the door answer 500.
    enabled: open && offerId !== '',
  }
}

/** What the read has done so far, as the sheet sees it. */
export type WhatIfRead =
  | { status: 'pending' }
  /** `code` is `apiErrorCode`'s, where the server refused with one. */
  | { status: 'error'; code?: string | null }
  | { status: 'success'; data: OfferWhatIf }

/** The one code on this read that means the card is stale (CONTRACT.md §3.9). */
export const WHAT_IF_STALE = 'ITEM_NOT_FOUND'

export type SheetFigures =
  | { kind: 'pending'; definition: GuidancePhrase | null }
  | { kind: 'failed'; definition: GuidancePhrase | null }
  /** `ITEM_NOT_FOUND`: no longer a near-miss on this order. The sheet says so and re-reads the order. */
  | { kind: 'stale'; definition: GuidancePhrase | null }
  | {
      kind: 'priced'
      /** The size of the engine's (negative, VAT-inclusive) `saving` — presentation, not arithmetic. */
      saving: number
      /** `unitAfter`, verbatim; null ⇒ no per-unit figure. */
      eachAfter: number | null
      payableBefore: number
      payableAfter: number
      fires: boolean
    }

export function sheetFigures(read: WhatIfRead, definition: OfferDefinition | null | undefined): SheetFigures {
  if (read.status === 'success')
    return {
      kind: 'priced',
      saving: Math.abs(read.data.saving),
      eachAfter: read.data.unitAfter ?? null,
      payableBefore: read.data.payableBefore,
      payableAfter: read.data.payableAfter,
      fires: read.data.fires,
    }
  const kind = read.status === 'pending' ? 'pending' : read.code === WHAT_IF_STALE ? 'stale' : 'failed'
  return { kind, definition: definitionFigure(definition) }
}

const KEY = 'callcenter:offer.sheet.definition'

/**
 * The definition as a figure, for where the money will be: *100% off 1*, *20% off 2*, *10 off*,
 * *For 29.95*. The percent's count is the get side, or the buy side where there is none. 🚩 Never a
 * saving: `discountValue` is what the record states, not what this basket would get.
 */
export function definitionFigure(definition: OfferDefinition | null | undefined): GuidancePhrase | null {
  const value = positive(definition?.discountValue)
  if (!definition || value === null) return null
  if (definition.discountType === 'percent') {
    const count = positive(definition.getQty) ?? positive(definition.buyQty)
    return count === null
      ? { key: `${KEY}.percentOnly`, params: { value } }
      : { key: `${KEY}.percent`, params: { value, count } }
  }
  if (definition.discountType === 'amount' || definition.discountType === 'price')
    return { key: `${KEY}.${definition.discountType}`, params: { value } }
  return null
}

const positive = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

const HOW = 'callcenter:offer.sheet.how'

export interface HowItWorks {
  /** *Buy 3 of this item*; null with no single buy quantity (a value threshold, several prerequisites). */
  buy: GuidancePhrase | null
  /** *Get 1 more of it free*, or the discount on what is bought; null for a shape with no words. */
  get: GuidancePhrase | null
  /** Units for the progress bar (`offer-strip.ts`'s count, free units included); null with no units. */
  progress: { have: number; total: number } | null
}

/** The buy side and the get side in words, and the units for the bar (D3). Counts, never money. */
export function howItWorks(definition: OfferDefinition | null | undefined, progress: NearMiss['progress']): HowItWorks {
  const strip = offerStrip(progress, definition)
  const bar = strip ? { have: strip.have, total: strip.total } : null
  if (!definition) return { buy: null, get: null, progress: null }
  const buy = positive(definition.buyQty)
  const getQty = positive(definition.getQty)
  const value = positive(definition.discountValue)
  const type = definition.discountType
  let get: GuidancePhrase | null = null
  if (value !== null && getQty !== null) {
    const same = definition.getSameItem === true
    if (type === 'percent')
      get =
        value >= 100
          ? { key: `${HOW}.${same ? 'getSameFree' : 'getOtherFree'}`, params: { count: getQty } }
          : { key: `${HOW}.${same ? 'getSamePercent' : 'getOtherPercent'}`, params: { count: getQty, value } }
  } else if (value !== null && (type === 'percent' || type === 'amount' || type === 'price')) {
    get = { key: `${HOW}.buy${type[0].toUpperCase()}${type.slice(1)}`, params: { value } }
  }
  return {
    buy: buy === null ? null : { key: `${HOW}.buy`, params: { count: buy, uom: definition.buyUom ?? '' } },
    get,
    progress: bar,
  }
}

export interface WhoGetsIt {
  /** Tier codes; empty ⇒ every caller. */
  tiers: string[]
  /** The server's `callerQualifies`, verbatim — the console never compares a tier itself. */
  qualifies: boolean
  phoneOnly: boolean
}

/** Who the offer is for (D4: server facts). `null` where the wire said nothing (a v1.13 server). */
export function whoGetsIt(audience: OfferAudience | null | undefined): WhoGetsIt | null {
  if (!audience) return null
  return {
    tiers: (audience.tiers ?? []).map((code) => (typeof code === 'string' ? code.trim() : '')).filter((code) => code !== ''),
    qualifies: audience.callerQualifies === true,
    phoneOnly: audience.channelOnly === true,
  }
}

const SAY = 'callcenter:offer.say'

/**
 * The sheet's longer script (D7): the pitch card's sentences, then *your membership qualifies*
 * where the offer is tier-limited and the caller qualifies, then — only once the what-if answered —
 * the engine's saving and the total it becomes, both formatted server figures handed in as strings.
 */
export function sheetSay({
  pitch,
  who,
  priced,
}: {
  pitch: GuidancePhrase[]
  who: WhoGetsIt | null
  priced: { saving: string; after: string } | null
}): GuidancePhrase[] {
  const phrases = [...pitch]
  if (who && who.tiers.length > 0 && who.qualifies) phrases.push({ key: `${SAY}.qualifies`, params: {} })
  // `currency` is a word SayLine says in each sentence's own language.
  if (priced) phrases.push({ key: `${SAY}.wouldSave`, params: { amount: priced.saving, after: priced.after, currency: true } })
  return phrases
}

/** One *Add to the order* row: its own item, never the offer's. */
export interface AddRow {
  itemNumber: string
  /** In the item's base unit, as the what-if (or the card) states it. */
  qty: number
  /** The bonus buy's unit for this row, or null: carried to the add. */
  uom: string | null
  /** The item's name as the basket holds it; `null` when it is not on a line (the row is its number). */
  name: string | null
  /** The prerequisite material's row: `ResolvePrereq`'s top-row stock is about this item only. */
  stock: boolean
}

/**
 * The sheet's add rows (997). A get item that is not the buy item (`getSameItem: false`) is a
 * different item: it is named from its own basket line, and the prerequisite's stock is drawn only
 * on the prerequisite's row.
 */
export function addRows(
  adds: readonly { itemNumber: string; qty: number; uom?: string | null }[],
  basket: readonly { itemNumber: string; description: string }[],
  prereqMaterial: string,
): AddRow[] {
  return adds.map(({ itemNumber, qty, uom }) => ({
    itemNumber,
    qty,
    uom: uom ?? null,
    name: basket.find((line) => line.itemNumber === itemNumber)?.description || null,
    stock: prereqMaterial !== '' && itemNumber === prereqMaterial,
  }))
}

/**
 * What the offer has given so far on this basket (the size of its fired amounts), taken when the
 * sheet opens. A blank id (859) addresses nothing, so it has given nothing the sheet can know of.
 */
export function firedTotal(fired: readonly FiredPromotion[] | null | undefined, offerId: string): number {
  if (offerId === '') return 0
  return (fired ?? []).filter((promotion) => promotion.offerId === offerId).reduce((sum, promotion) => sum + Math.abs(promotion.amount), 0)
}

/**
 * The engine's amount once the open sheet's offer FIRED, else `null` (997). It fired only if it
 * gives more than it did when the sheet opened: an offer that had already fired once and was one
 * step from a second round has not fired again when that near-miss merely disappears (a unit
 * removed) — that is the offer gone, not applied.
 */
export function sheetApplied(before: number, fired: readonly FiredPromotion[] | null | undefined, offerId: string): number | null {
  if (offerId === '' || firedTotal(fired, offerId) <= before) return null
  return (fired ?? []).filter((promotion) => promotion.offerId === offerId).reduce((sum, promotion) => sum + promotion.amount, 0)
}
