import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import i18n from '@/core/i18n'
import type { PriceCheckOffer } from '@/core/models/callcenter'
import {
  PRICE_CHECK,
  PRICE_CHECK_LINE,
  PRICE_CHECK_NO_PRICE,
  PRICE_CHECK_REFUSED,
} from './__fixtures__/payloads'
import { searchRowView } from './item-search'
import { priceCheckPanel, type PriceCheckPanel } from './price-check-view'

/**
 * Ticket 185 — the *about this item* panel's price half, as rules rather than as
 * markup.
 *
 * The corpus is the **capture** `12-price-check.json` (857, contract v1.10): one
 * exchange that price-checked item `200021` and then added the same item to the
 * same order, which is what lets §3.4 rule 1 — *the quote equals the line* — be
 * asserted off the wire's own bytes rather than off two numbers an author made
 * agree.
 *
 * 🚩 The standing rule holds here as everywhere: **no case treats a fixture VALUE
 * as evidence of engine behaviour, only its SHAPE** — except the one case whose
 * whole subject IS the relationship between two captured values.
 */

/** The search row the panel expands FROM. It is passed in carrying its `≈`
 *  estimate on purpose: the model is where a fall-back to that number would have
 *  to be written, so it is where the absence of one is proved. */
const ROW = searchRowView({
  materialNumber: '200021',
  descriptionEn: '8X4 DEO SPRAY MODN CHARM 150ML',
  descriptionAr: '8×4 بخاخ مودرن حريمى مزيل عرق 150مل',
  // 🚩 Under what the caller pays — the gap the whole ticket exists for — and
  // deliberately a figure the capture contains NOWHERE: not its `gross`, not its
  // `net`, not a condition value. `Item.UnitPrice` is a material-master column and
  // `VKP0` is a condition record; they happen to agree in this store's data, and
  // an estimate set to the value they share would make the assertion below unable
  // to fail on a QUOTED panel.
  estimatePriceExVat: 12.5,
  atp: 4,
})

/**
 * *Formatted as money*, in the two parts `guidance-view.test.ts` already settled
 * them (US52) — a figure wearing a **currency word**, or one whose decimals were
 * **forced** to two (`35.00`), which is the shape a money formatter produces.
 * `29.95` is not that: it is the numeral the value already is, and it round-trips
 * through `Number` unchanged, which is exactly what tells the two apart.
 *
 * 🚩 The predicate is repeated rather than imported: the guidance strip's test
 * owns its region's rule and this one owns the panel's, and a shared helper
 * relaxed for one surface would silently relax the other.
 */
const MONEY_SHAPED = (figure: string) =>
  /(?:SAR|SR)\s*\d|\d\s*(?:SAR|SR)\b/.test(figure) ||
  (/^\d+\.\d{2}$/.test(figure) && String(Number(figure)) !== figure)

/** Any figure at all, for the states whose claim is stronger than the region's:
 *  a refusal and a read in flight must carry NO number, because there is nothing
 *  for one to be about. */
const ANY_FIGURE = /\d+\.\d/

/** Resolve every phrase the way the render tier does, so what is scanned for
 *  money is the WORDS an agent reads and not a key shape. */
const say = (phrase: { key: string; params: Record<string, string | number | boolean> } | null) =>
  phrase ? i18n.t(phrase.key, phrase.params) : ''

/** Every figure and phrase the offers region itself produces — the server's own
 *  `description` excluded, because it is data and the console does not author it.
 *  Everything else is the console's, and is subject to the rule. */
const offersRegionFigures = (panel: PriceCheckPanel): string[] => {
  if (panel.kind !== 'quoted') throw new Error(`not quoted: ${panel.kind}`)
  return panel.offers.flatMap((offer) => [
    say(offer.definition),
    say(offer.set),
    say(offer.reason),
    ...Object.values(offer.definition?.params ?? {}).map(String),
    ...Object.values(offer.set?.params ?? {}).map(String),
    String(offer.shortfall),
    ...(offer.progress ? [String(offer.progress.have), String(offer.progress.need)] : []),
  ])
}

const quoted = () => priceCheckPanel({ canPriceCheck: true, row: ROW, result: PRICE_CHECK })

describe('priceCheckProjectsConditionsAndOffers', () => {
  it('quotes the engine price at the order own plant, VAT included, one unit', () => {
    const panel = quoted()
    expect(panel.kind).toBe('quoted')
    if (panel.kind !== 'quoted') return
    expect(panel.quote.gross).toBe(PRICE_CHECK.unitPrice.gross)
    // WHERE it was priced is part of the answer: a price with no store beside it
    // is the seeded-plant harm said out loud (§3.4 rule 5).
    expect(panel.quote.plantName).toBe(PRICE_CHECK.plantName)
    expect(panel.quote.uom).toBe(PRICE_CHECK.uom)
  })

  it('🚩 quotes exactly what the basket line for the same item under the same header costs', () => {
    const panel = quoted()
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    // §3.4 rule 1 — the whole ticket. Both sides are the CAPTURE's: one engine
    // run at one header, once as a quote and once as a line.
    expect(panel.quote.gross).toBe(PRICE_CHECK_LINE.unitPrice.gross)
  })

  it('passes the conditions behind the price through, statistical flag and all', () => {
    const panel = quoted()
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    expect(panel.quote.conditions).toEqual(PRICE_CHECK.conditions)
    // The store price and VAT as SEPARATE things — that separation is what
    // explains the gap to the estimate on the row above (§2.1).
    expect(panel.quote.conditions.length).toBeGreaterThan(1)
  })

  it('projects the offers in the server own order, in the guidance strip vocabulary', () => {
    const panel = quoted()
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    expect(panel.offers.map((offer) => offer.description)).toEqual(
      PRICE_CHECK.offers.map((offer) => offer.description),
    )
    expect(panel.offers.map((offer) => offer.progress)).toEqual(
      PRICE_CHECK.offers.map((offer) => offer.progress),
    )
  })

  it('🚩 says offers were not fully checked while offersComplete is false', () => {
    const panel = quoted()
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    expect(PRICE_CHECK.offersComplete).toBe(false)
    expect(panel.offersComplete).toBe(false)
  })

  it('and stops saying it the moment the server flips the flag — no other change', () => {
    const before = quoted()
    const after = priceCheckPanel({
      canPriceCheck: true,
      row: ROW,
      result: { ...PRICE_CHECK, offersComplete: true },
    })
    if (before.kind !== 'quoted' || after.kind !== 'quoted') throw new Error('not quoted')
    expect(after.offersComplete).toBe(true)
    // 🚩 787-C flips ONE boolean and the client does not move: same offers, same
    // quote. That is what "it flips to true with no client change" means, made
    // mechanical rather than promised.
    expect(after.offers).toEqual(before.offers)
    expect(after.quote).toEqual(before.quote)
  })

  it('draws no panel at all while the gate is shut', () => {
    // §3.4 rule 5 — `canAddItem`'s predicate, and absent on a pre-1.6 server.
    // Read strictly: no panel beats a panel quoting from a store nobody chose.
    expect(priceCheckPanel({ canPriceCheck: false, row: ROW, result: PRICE_CHECK }).kind).toBe('shut')
    expect(priceCheckPanel({ canPriceCheck: undefined, row: ROW, result: PRICE_CHECK }).kind).toBe('shut')
  })
})

describe('theOffersRegionHoldsNoFigureFormattedAsMoney', () => {
  /**
   * The fixture is chosen for the trap: its BBY description carries a currency
   * word and a figure the console MAY NOT EDIT (`"2 PC for 29.95 SR"` is in this
   * repo's own 098 captures). The broad *no `SAR` anywhere* form fails on it, so
   * the rule is asserted in its narrow form — everything the console AUTHORS.
   */
  const TRAP: PriceCheckOffer = {
    offerId: 'BBY-4471',
    description: '2 PC for 29.95 SR — SAR 10 off when you buy 3',
    isReady: false,
    progress: { have: 1, need: 2 },
    skipReason: null,
    // A set price, which is the discount kind whose DEFINITION comes nearest to
    // being money: `both for 29.95` is a figure, and 161's rule is what keeps the
    // currency word off it.
    discount: { discountType: 'P', value: 29.95, quantity: 2 },
  }

  const panel = priceCheckPanel({
    canPriceCheck: true,
    row: ROW,
    result: { ...PRICE_CHECK, offers: [...PRICE_CHECK.offers, TRAP] },
  })

  it('recognises the shape it is guarding against', () => {
    // The guard's own self-test: a rule this narrow is worthless if it quietly
    // stops matching, and a passing suite would never say so.
    for (const money of ['12.00', '8.40', '8.40 SAR', 'SAR 10.00', '29.95 SR'])
      expect(MONEY_SHAPED(money), money).toBe(true)
    // The honest numerals a definition may carry, and the counts a meter does.
    for (const notMoney of ['20', '12.5', '3', '29.95', '42']) expect(MONEY_SHAPED(notMoney), notMoney).toBe(false)
  })

  it('reads the trap fixture as a description that really does carry money', () => {
    // The assertion below is only worth anything if this holds — it is what
    // makes the narrow form necessary rather than a convenience.
    expect(MONEY_SHAPED(TRAP.description)).toBe(true)
  })

  it('🚩 holds no figure formatted as money in anything the console authored', () => {
    for (const figure of offersRegionFigures(panel)) expect(MONEY_SHAPED(figure), figure).toBe(false)
  })

  it('and the quote it sits beside IS engine money, which is what the rule protects', () => {
    // The two halves of one panel, and the difference between them is the whole
    // register rule: the price is money and says `SAR`; the offers are promises
    // and say none.
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    expect(panel.quote.gross).toBe(PRICE_CHECK.unitPrice.gross)
  })

  it('passes the server own words through unedited, currency word and all', () => {
    if (panel.kind !== 'quoted') throw new Error('not quoted')
    expect(panel.offers.at(-1)?.description).toBe(TRAP.description)
  })
})

describe('aPricingFailureIsARefusalAndNeverTheEstimate', () => {
  const refusalOf = (envelope: { data: unknown; errors: { errorCode: string }[] | null }, status: number) =>
    priceCheckPanel({
      canPriceCheck: true,
      row: ROW,
      error: new ApiError('business', 'server sentence', status, envelope.errors as never, envelope.data),
    })

  it('refuses before the caller is attached, in the agent own words', () => {
    const panel = refusalOf(PRICE_CHECK_REFUSED as never, 409)
    expect(panel.kind).toBe('refused')
    if (panel.kind !== 'refused') return
    expect(say(panel.refusal)).toMatch(/caller/i)
    // 🚩 The wire code never reaches the screen.
    expect(say(panel.refusal)).not.toMatch(/NO_CUSTOMER_ATTACHED/)
  })

  it('refuses an item that does not price at the order own plant', () => {
    const panel = refusalOf(PRICE_CHECK_NO_PRICE as never, 409)
    expect(panel.kind).toBe('refused')
    if (panel.kind !== 'refused') return
    expect(say(panel.refusal)).not.toMatch(/NO_PRICE_AT_PLANT/)
    expect(say(panel.refusal).length).toBeGreaterThan(0)
  })

  it('words a code it has never seen without leaking it', () => {
    const panel = priceCheckPanel({
      canPriceCheck: true,
      row: ROW,
      error: new ApiError('business', 'server sentence', 409, [
        { errorCode: 'SOMETHING_NEW_IN_V2', internalErrorCode: null, errorMessage: '' },
      ] as never),
    })
    if (panel.kind !== 'refused') throw new Error('not refused')
    expect(say(panel.refusal)).not.toMatch(/SOMETHING_NEW_IN_V2/)
    expect(say(panel.refusal).length).toBeGreaterThan(0)
  })

  it('🚩 NEVER falls back to the row estimate — there is nowhere for it to go', () => {
    const panel = refusalOf(PRICE_CHECK_REFUSED as never, 409)
    // The estimate went IN (`ROW` carries `≈12.86`) and the refusal state has no
    // field that could carry it out. Serialised, because the claim is about the
    // whole state and not about one property somebody remembered to check.
    expect(JSON.stringify(panel)).not.toMatch(/12\.86/)
    expect(JSON.stringify(panel)).not.toMatch(ANY_FIGURE)
  })

  it('and a refusal is not a quote — no price, no conditions, no offers', () => {
    const panel = refusalOf(PRICE_CHECK_REFUSED as never, 409)
    expect(Object.keys(panel).sort()).toEqual(['itemNumber', 'kind', 'refusal'])
  })

  it('is pending while the read is in flight, and that is not a refusal', () => {
    expect(priceCheckPanel({ canPriceCheck: true, row: ROW, pending: true }).kind).toBe('pending')
    // 🚩 Nor is it a quote of nought: a panel that drew a price before it had one
    // is the same harm as the estimate, one frame earlier.
    expect(JSON.stringify(priceCheckPanel({ canPriceCheck: true, row: ROW, pending: true }))).not.toMatch(ANY_FIGURE)
  })
})
