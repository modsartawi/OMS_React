import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import type { NearMiss } from '@/core/models/callcenter'
import { NEAR_MISSES, NEAR_MISS_CLASSES } from './__fixtures__/payloads'
import { guidanceView, type GuidanceCard, type GuidancePhrase } from './guidance-view'

/**
 * Ticket 171 — the guidance strip's two pure rulings.
 *
 * Two corpora, and which one a case reads is the case's own claim:
 *
 * - `NEAR_MISSES` is the **v1.2 capture** of `03-near-miss-buy-side` — what the
 *   engine really projects off this store's master data. Two offers, both
 *   unready, and every `offerId` blank (859). Anything that must hold against
 *   the wire as it is today reads this.
 * - `NEAR_MISS_CLASSES` is the v1.0 provisional, held in
 *   `__fixtures__/unreachable-v1_0.json` under its own warning: one of each
 *   rendering class, which the capture has no live source for and cannot until
 *   855 and 859 land. The class rulings read this, and they are hypotheses until
 *   then — CONTRACT.md §11's own words.
 */

/** Resolve a phrase the way the render tier does, so what is asserted is WORDS
 *  rather than key shapes — 161's precedent, and the only way to see that an
 *  unknown skip category reads as a sentence rather than as a code. */
const say = (phrase: GuidancePhrase | null) => (phrase ? i18n.t(phrase.key, phrase.params) : null)

const card = (view: ReturnType<typeof guidanceView>, offerId: string): GuidanceCard => {
  const found = view.cards.find((c) => c.offerId === offerId)
  if (!found) throw new Error(`no card for ${offerId}`)
  return found
}

describe('nearMissesSortIntoThreeClasses', () => {
  const view = guidanceView(NEAR_MISS_CLASSES)

  it('reads the fixture as one of each class', () => {
    expect(view.cards.map((c) => c.klass)).toEqual(['actionable', 'counted', 'unavailable'])
    expect(view.actionableCount).toBe(1)
  })

  it('preserves the order the server sent, ready-first and unsorted', () => {
    // §3.1 sorts ready-first server-side. The classes are a rendering RANK; the
    // list is the engine's, and a view model that re-ordered it would be
    // overruling the sort the contract specifies.
    expect(view.cards.map((c) => c.offerId)).toEqual(NEAR_MISS_CLASSES.map((m) => m.offerId))
  })

  it('gives the actionable class its action and nothing else one', () => {
    // The delta is what the agent DOES. `counted` and `unavailable` carry no
    // shortfall and no set statement at all — there is nothing to add, and a
    // card that offered one would be an action against a decision already made.
    expect(card(view, 'BBY-5510').shortfall).toBe(1)
    expect(card(view, 'BBY-5602').shortfall).toBe(0)
    expect(card(view, 'BBY-5602').set).toBeNull()
    expect(card(view, 'BBY-6120').shortfall).toBe(0)
    expect(card(view, 'BBY-6120').set).toBeNull()
  })

  it('states a grouping prerequisite as a set with its honest cardinality', () => {
    // US42: `any 1 from this selection · 42 qualify` — never one named item,
    // which would imply the caller must buy that one.
    expect(say(card(view, 'BBY-5510').set)).toBe('any 1 from this selection · 42 qualify')
  })

  it('opens the top-ranked actionable offer by construction', () => {
    // 138 finding 4: drawn with a hardcoded id first, and the big-set scenario
    // rendered collapsed. It is the FIRST actionable in the server's order.
    expect(view.openByDefault).toBe('BBY-5510')
    expect(guidanceView([NEAR_MISS_CLASSES[1], NEAR_MISS_CLASSES[2]]).openByDefault).toBeNull()
  })

  it('says why an unreachable offer is unreachable, in the agent’s words', () => {
    expect(say(card(view, 'BBY-6120').reason)).toBe("can't be checked from this basket")
    expect(card(view, 'BBY-5510').reason).toBeNull()
    expect(card(view, 'BBY-5602').reason).toBeNull()
  })

  it('has a phrase for every §3.2 category', () => {
    const categories = [
      'ORIGIN_FILTERED',
      'PLANT_FILTERED',
      'VALIDITY_WINDOW',
      'CUSTOMER_SEGMENT',
      'NOT_DISCOVERED',
    ]
    for (const skipReason of categories) {
      const words = say(guidanceView([miss({ skipReason })]).cards[0].reason)
      expect(words).toBeTruthy()
      // Words, not a code: no SHOUTING_SNAKE_CASE survives to the screen.
      expect(words).not.toMatch(/[A-Z]{3,}_/)
      expect(words).not.toContain(skipReason)
    }
  })

  it('reads a category this client has never seen as words rather than a code', () => {
    // §9: a new category is a MINOR bump that ships server-first. The console
    // renders it, and the one thing it may not do is print the wire code.
    const unknown = guidanceView([miss({ skipReason: 'ACCUMULATION_EXHAUSTED' })]).cards[0]
    expect(unknown.klass).toBe('unavailable')
    expect(say(unknown.reason)).toBe("this offer isn't available on this order")
    expect(say(unknown.reason)).not.toContain('ACCUMULATION_EXHAUSTED')
  })

  it('treats a skipped offer as unavailable even when it says it is ready', () => {
    // The skip is asked FIRST: an offer the engine never evaluated is out of
    // reach whatever its progress claims.
    const skippedButReady = guidanceView([miss({ isReady: true, skipReason: 'ORIGIN_FILTERED' })]).cards[0]
    expect(skippedButReady.klass).toBe('unavailable')
  })

  it('carries the discount definition as the headline where the wire states one', () => {
    // The definition is 161's rule, resolved from `@/core/` — and the server's
    // own description stays untouched beside it as the sub-line.
    const percent = guidanceView([miss({ discount: { discountType: '%', value: 20 } })]).cards[0]
    expect(i18n.t(percent.definition!.key, percent.definition!.params)).toBe('20% off')
    expect(percent.description).toBe('SAR 10 off when you buy 3 — baby care')

    const setPrice = guidanceView([miss({ discount: { discountType: 'P', value: 29.95, quantity: 2 } })]).cards[0]
    expect(i18n.t(setPrice.definition!.key, setPrice.definition!.params)).toBe('Both for 29.95')

    const freeGoods = guidanceView([miss({ discount: { discountType: 'N', value: 1, nthFree: 3 } })]).cards[0]
    expect(i18n.t(freeGoods.definition!.key, freeGoods.definition!.params)).toBe('3rd free')
  })

  it('degrades to the server’s own words while the wire carries no discount block', () => {
    // 🚩 The block is additive (§9) and the frozen fixtures do not carry it. The
    // card must still say something honest, so the description carries it alone.
    for (const c of view.cards) {
      expect(c.definition).toBeNull()
      expect(c.description).toBeTruthy()
    }
  })

  it('draws a meter only where the wire stated a requirement', () => {
    expect(card(view, 'BBY-5510').progress).toEqual({ have: 1, need: 2 })
    expect(guidanceView([miss({ progress: { have: 0, need: 0 } })]).cards[0].progress).toBeNull()
    // Never overfilled: a projection that says 4 of 2 is drawn as a full meter,
    // not as a meter with two extra pips.
    expect(guidanceView([miss({ progress: { have: 4, need: 2 } })]).cards[0].progress).toEqual({ have: 2, need: 2 })
  })

  it('survives a near-miss the wire under-populated', () => {
    // Unknown fields are ignored by rule; ABSENT ones must degrade rather than
    // throw. A prerequisite kind this client does not know is not guessed at.
    const sparse = guidanceView([
      { offerId: 'X', description: '', isReady: false, progress: { have: 1, need: 2 }, prereq: null, skipReason: null },
      miss({ prereq: { kind: 'accumulation' } }),
    ])
    expect(sparse.cards[0].set).toBeNull()
    expect(sparse.cards[1].set).toBeNull()
    expect(sparse.actionableCount).toBe(2)
  })

  it('says the get side is not covered until a get-side prerequisite arrives', () => {
    // 138 scenario 9: the acknowledgement must disappear ON ITS OWN when 787-C
    // lands, with no other change — so it is derived from the projection, and a
    // `condition` prerequisite in the list IS the coverage landing.
    expect(view.getSideCovered).toBe(false)
    expect(guidanceView([miss({ prereq: { kind: 'condition', eligibleCount: 18 } })]).getSideCovered).toBe(true)
  })

  it('answers an empty projection with an empty view, not a hole', () => {
    expect(guidanceView([]).cards).toEqual([])
    expect(guidanceView(undefined).actionableCount).toBe(0)
    expect(guidanceView(null).openByDefault).toBeNull()
  })
})

/**
 * `noFigureInTheRegionIsFormattedAsMoney` — the region's own property (US52).
 *
 * The rule is *formatted as money* — two forced decimals, the shape that reads
 * as a price with a currency word beside it — and NOT "no `SAR` anywhere": the
 * fixture's own `"SAR 10 off when you buy 3 — baby care"` is server text nobody
 * may edit, and the broad form would fail on it.
 */
describe('noFigureInTheRegionIsFormattedAsMoney', () => {
  /**
   * What "formatted as money" actually means, in two parts:
   *
   * - a figure wearing a **currency word** (`8.40 SAR`, `SAR 10.00`) — and
   *   deliberately NOT "contains SAR", which would fail on server text;
   * - a figure whose decimals were **forced** to two (`35.00`, `8.40`) — the
   *   shape a money formatter produces. `29.95` is not that: it is the numeral
   *   the value already is, and it round-trips through `Number` unchanged, which
   *   is exactly what tells the two apart.
   */
  const MONEY_SHAPED = (figure: string) =>
    /(?:SAR|SR)\s*\d|\d\s*(?:SAR|SR)\b/.test(figure) ||
    (/^\d+\.\d{2}$/.test(figure) && String(Number(figure)) !== figure)

  /** Every figure and phrase the view model itself produces — the server's own
   *  `description` excluded, because it is data and the console does not author
   *  it. Everything else here is the console's, and is subject to the rule. */
  const produced = (card: GuidanceCard): string[] => [
    ...Object.values(card.definition?.params ?? {}).map(String),
    ...Object.values(card.set?.params ?? {}).map(String),
    ...Object.values(card.reason?.params ?? {}).map(String),
    String(card.shortfall),
    ...(card.progress ? [String(card.progress.have), String(card.progress.need)] : []),
  ]

  it('recognises the shape it is guarding against', () => {
    // The guard's own self-test: a rule this narrow is worthless if it quietly
    // stops matching, and a passing suite would never say so.
    for (const money of ['12.00', '8.40', '8.40 SAR', 'SAR 10.00', '29.95 SR'])
      expect(MONEY_SHAPED(money), money).toBe(true)
    // The honest numerals a definition may carry, and the counts a meter does.
    for (const notMoney of ['20', '12.5', '3', '29.95', '42']) expect(MONEY_SHAPED(notMoney), notMoney).toBe(false)
  })

  it('produces no money-shaped figure over a fixture whose text carries a currency word', () => {
    const view = guidanceView(NEAR_MISS_CLASSES)
    // The server's text is untouched — the currency word is still there, on the
    // card, exactly as the engine sent it.
    expect(card(view, 'BBY-5602').description).toBe('SAR 10 off when you buy 3 — baby care')
    for (const c of view.cards) for (const figure of produced(c)) expect(MONEY_SHAPED(figure), figure).toBe(false)
  })

  it('produces no money-shaped figure even from a set-price definition', () => {
    // 🚩 The one place a two-decimal figure could honestly arise. `29.95` is the
    // definition's own numeral — `29.95 SAR` and `30.00` are what may not exist.
    const setPrice = guidanceView([miss({ discount: { discountType: 'P', value: 29.95, quantity: 2 } })]).cards[0]
    const value = String(setPrice.definition!.params.value)
    expect(value).toBe('29.95')
    expect(MONEY_SHAPED(value)).toBe(false)
    expect(guidanceView([miss({ discount: { discountType: 'R', value: 30 } })]).cards[0].definition!.params.value).toBe(
      '30',
    )
  })

  it('exposes no savings total anywhere — there is no field to read one from', () => {
    // The strong form: over the whole view model, the ONLY numbers are the
    // meter's counts, the shortfall and the eligible population. `wouldSave`
    // does not exist on the wire and no client-side equivalent may replace it
    // (spec 574 US26), so a future caller must not find a field to print.
    const allowed = new Set(['have', 'need', 'shortfall', 'count', 'eligible'])
    for (const c of guidanceView([...NEAR_MISS_CLASSES, miss({ discount: { discountType: '%', value: 20 } })]).cards) {
      for (const [key] of numbersIn(c)) expect(allowed.has(key), `numeric field ${key}`).toBe(true)
      expect(JSON.stringify(c)).not.toMatch(/save|saving|total/i)
    }
  })
})

/**
 * `theGetSideNoticeIsAPropertyOfTheSurface` (ticket 172).
 *
 * 787-C has not landed: buy-one-get-one near-misses are **absent, not empty**
 * (BBY lookup keys on the condition-side access tables, so a basket holding only
 * the buy-side item never loads the promotion — 130's headline blocker). The
 * surface acknowledges that once, quietly, at its edge.
 *
 * 🚩 The property that matters is that it **disappears on its own**: it is
 * derived from the projection rather than configured, so a get-side prerequisite
 * arriving IS the coverage landing — with **nothing else in the view model
 * changing**. A flag would need a deploy; this needs a server that has started
 * sending them.
 */
describe('theGetSideNoticeIsAPropertyOfTheSurface', () => {
  /** The same three offers, with a get-side prerequisite added — 787-C landing. */
  const GET_SIDE: NearMiss = miss({
    offerId: 'BBY-6033',
    prereq: { kind: 'condition', groupingId: 'G-6033', eligibleCount: 18 },
  })

  it('is present while no get-side near-miss can arrive', () => {
    expect(guidanceView(NEAR_MISS_CLASSES).getSideCovered).toBe(false)
    // Not a property of a CARD: no card carries it, and no class implies it.
    for (const c of guidanceView(NEAR_MISS_CLASSES).cards) expect('getSideCovered' in c).toBe(false)
  })

  it('is gone the moment one does', () => {
    expect(guidanceView([...NEAR_MISS_CLASSES, GET_SIDE]).getSideCovered).toBe(true)
    // A buy-side `grouping` is NOT coverage — the distinction is the whole point.
    expect(guidanceView([...NEAR_MISS_CLASSES, miss({ offerId: 'X' })]).getSideCovered).toBe(false)
  })

  it('changes nothing else in the view model when it does', () => {
    // 138 scenario 9, as an assertion. The two projections differ in ONE field
    // of one offer — the prerequisite's kind — so every other field of the view
    // model is byte-identical, and the acknowledgement's disappearance is the
    // only visible consequence of the server starting to send them.
    const buySide = miss({ offerId: 'BBY-6033', prereq: { kind: 'grouping', groupingId: 'G-6033', eligibleCount: 18 } })
    const before = guidanceView([...NEAR_MISS_CLASSES, buySide])
    const after = guidanceView([...NEAR_MISS_CLASSES, GET_SIDE])
    expect(before.getSideCovered).toBe(false)
    expect(after).toEqual({ ...before, getSideCovered: true })
    // The get-side offer is drawn like any other actionable one — it does not
    // arrive as a fourth class.
    expect(after.cards[3].klass).toBe('actionable')
  })
})

/**
 * `theStripHoldsAgainstTheWireAsItActuallyIs` (ticket 177).
 *
 * Everything above reads the provisional three-class list, because the capture
 * has no source for the classes. This reads the **capture** — and what it finds
 * is the state the console will actually meet on the day it is pointed at the
 * real server: two offers, both unready, and **no `offerId` on either of them**
 * (859). The strip is keyed on that field.
 *
 * 🚩 Nothing here asserts the strip is USEFUL in that state — it is not, and 859
 * is why. What it asserts is that the strip stays HONEST: it does not throw, it
 * does not collapse two offers into one card, and it does not invent an identity
 * the wire declined to give.
 */
describe('theStripHoldsAgainstTheWireAsItActuallyIs', () => {
  const view = guidanceView(NEAR_MISSES)

  it('draws one card per offer even when the wire names none of them', () => {
    // 🚩 The hazard 859 creates on this side, and a real defect the capture
    // found: two DISTINCT offers arriving under the same empty key. Keyed on
    // `offerId`, React de-duplicated them and opening one opened both — the
    // agent was shown one offer where the engine sent two.
    expect(NEAR_MISSES.map((m) => m.offerId)).toEqual(['', ''])
    expect(view.cards).toHaveLength(NEAR_MISSES.length)
    expect(view.cards.map((c) => c.description)).toEqual(NEAR_MISSES.map((m) => m.description))
  })

  it('gives every card a distinct identity even where the wire gave none', () => {
    // The identity the STRIP keys and opens by. Distinct per card, whether or
    // not the wire named the offer.
    expect(new Set(view.cards.map((c) => c.cardId)).size).toBe(view.cards.length)
    // ...and it opens exactly one of them, not both.
    expect(view.cards.filter((c) => c.cardId === view.openByDefault)).toHaveLength(1)
  })

  it('keeps the offer id itself untouched — it is the server’s address', () => {
    // 🚩 `cardId` is a render key, never an offer identity: `addItem` and
    // `ResolvePrereq` address an offer by `offerId` (§3.3), and sending a
    // positional id would name a different offer on the next projection. So the
    // blank stays blank, and 859 stays visible rather than being papered over.
    expect(view.cards.map((c) => c.offerId)).toEqual(['', ''])
  })

  it('still gives a NAMED offer its own id as its identity', () => {
    // The fallback is for the blank case only — a named offer keeps a stable
    // identity across projections, which is what makes the open card survive an
    // add that re-orders the list.
    expect(guidanceView(NEAR_MISS_CLASSES).cards.map((c) => c.cardId)).toEqual(
      NEAR_MISS_CLASSES.map((m) => m.offerId),
    )
  })

  it('reads them as the class their projection actually states', () => {
    // Both are unready with a shortfall, so both are actionable — the capture
    // simply holds no `counted` and no `unavailable` offer.
    expect(view.cards.map((c) => c.klass)).toEqual(['actionable', 'actionable'])
    expect(view.actionableCount).toBe(2)
  })

  it('states a one-material prerequisite as that item, never as a selection', () => {
    // 🚩 Every captured prerequisite is `kind: 'material'` — the illustration
    // had none, so this leg of `setPhrase` had no fixture behind it until the
    // capture arrived. US42's rule runs both ways: a set sentence about exactly
    // one item would say *any 1 from this selection* of a thing the caller has
    // no selection over.
    for (const c of view.cards) expect(say(c.set)).toBe('1 more of this item')
    expect(view.cards.map((c) => c.eligible)).toEqual([1, 1])
  })

  it('still says the get side is uncovered, off a real projection', () => {
    // The acknowledgement is derived, not configured (172), so it has to answer
    // the same way over the wire's own near-misses as over the illustration.
    expect(view.getSideCovered).toBe(false)
  })

  it('produces no money-shaped figure over the captured offers either', () => {
    for (const c of view.cards)
      for (const figure of [
        ...Object.values(c.set?.params ?? {}).map(String),
        String(c.shortfall),
        ...(c.progress ? [String(c.progress.have), String(c.progress.need)] : []),
      ])
        expect(/(?:SAR|SR)\s*\d|\d\s*(?:SAR|SR)\b/.test(figure), figure).toBe(false)
  })
})

/** Every numeric leaf of a card, with the key it sat under. */
function numbersIn(value: unknown, key = ''): Array<[string, number]> {
  if (typeof value === 'number') return [[key, value]]
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => numbersIn(v, k))
  return []
}

/** A near-miss shaped like the fixture's, varied one field at a time — the
 *  shape is the contract's, and only what a case is about is spelled here. */
function miss(over: Partial<NearMiss>): NearMiss {
  return { ...NEAR_MISS_CLASSES[1], progress: { have: 1, need: 2 }, isReady: false, skipReason: null, ...over }
}

describe('a coupon-gated offer (159, contract v1.10 proposal)', () => {
  const couponGated = (): NearMiss => ({
    offerId: '',
    description: 'T173 COUPON-GATED BBY',
    isReady: false,
    progress: { have: 0, need: 1 },
    // The shape capture 02 actually carries — except for `kind`, which is
    // `material` there, which is the whole defect.
    prereq: { kind: 'coupon', materialNumber: 'COUPT173', eligibleCount: 1 },
    skipReason: null,
  })

  it('is never actionable, so it can never grow an Add', () => {
    // 🚩 `BonusBuySession.Prepare` filters only `!IsDeleted` — there is no
    // line-type filter on prerequisite matching — so a one-click add of the
    // campaign SKU qualifies the same bonus buy as a redeemed coupon while
    // burning nothing at the coupon service.
    const view = guidanceView([couponGated()])
    expect(view.actionable).toHaveLength(0)
    expect(view.needsCoupon).toHaveLength(1)
    expect(view.cards[0].klass).toBe('needsCoupon')
  })

  it('does not inflate the count the top bar mirrors', () => {
    // *One offer within reach* must mean one the agent can reach by putting
    // something in the basket.
    expect(guidanceView([couponGated()]).actionableCount).toBe(0)
  })

  it('is never the card that opens by default', () => {
    expect(guidanceView([couponGated()]).openByDefault).toBeNull()
  })

  it('is not filed as unavailable either — it is real and reachable', () => {
    // With a coupon it fires. Burying it with the origin-filtered and
    // out-of-window offers would tell the agent it cannot happen.
    expect(guidanceView([couponGated()]).unavailable).toHaveLength(0)
  })

  it('still yields to a skipReason — an offer that was never evaluated is not an offer', () => {
    const view = guidanceView([{ ...couponGated(), skipReason: 'ORIGIN_FILTERED' }])
    expect(view.cards[0].klass).toBe('unavailable')
    expect(view.needsCoupon).toHaveLength(0)
  })
})
