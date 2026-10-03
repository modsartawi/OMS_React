import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import type { NearMiss } from '@/core/models/callcenter'
import { GET_SHORTFALL, NEAR_MISSES, NEAR_MISS_CLASSES, PRICE_CHECK } from './__fixtures__/payloads'
import { guidanceView, type GuidanceCard, type GuidancePhrase } from './guidance-view'
import { searchRowView } from './item-search'
import { priceCheckPanel } from './price-check-view'

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
    expect(view.withinReachCount).toBe(1)
  })

  it('preserves the order the server sent, ready-first and unsorted', () => {
    // §3.1 sorts ready-first server-side. The classes are a rendering RANK; the
    // list is the engine's, and a view model that re-ordered it would be
    // overruling the sort the contract specifies.
    expect(view.cards.map((c) => c.offerId)).toEqual(NEAR_MISS_CLASSES.map((m) => m.offerId))
  })

  it('gives the actionable class its action and nothing else one', () => {
    // The delta is what the agent DOES. `counted` and `unavailable` carry no
    // delta and no set statement at all — there is nothing to add, and a
    // card that offered one would be an action against a decision already made.
    expect(card(view, 'BBY-5510').stillNeeded).toBe(1)
    expect(card(view, 'BBY-5602').stillNeeded).toBe(0)
    expect(card(view, 'BBY-5602').set).toBeNull()
    expect(card(view, 'BBY-6120').stillNeeded).toBe(0)
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
    expect(sparse.withinReachCount).toBe(2)
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
    expect(guidanceView(undefined).withinReachCount).toBe(0)
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
    String(card.stillNeeded),
    ...(card.progress ? [String(card.progress.have), String(card.progress.need)] : []),
    // Ticket 414 — the shortfall card's own phrases: every arm's subject and
    // discount, the link header and the coupon-spent line, as params AND as the
    // words they resolve to.
    ...card.arms.flatMap((arm) => [
      ...Object.values(arm.subject.params).map(String),
      ...Object.values(arm.discount?.params ?? {}).map(String),
      say(arm.subject) ?? '',
      say(arm.discount) ?? '',
    ]),
    ...[card.rewardLink, card.spentCoupons].flatMap((phrase) => [
      ...Object.values(phrase?.params ?? {}).map(String),
      say(phrase) ?? '',
    ]),
  ]

  /** A phrase resolves to a sentence; the guard is about its FIGURES. */
  const figuresIn = (texts: string[]): string[] =>
    texts.flatMap((text) => text.match(/(?:SAR|SR)\s*[\d.]+|[\d.]+\s*(?:SAR|SR)\b|\d+(?:\.\d+)?/g) ?? [])

  it('produces no money-shaped figure over the reward arms — a fixed-discount arm included (414)', () => {
    // 🚩 Staging's arm 2 is `R 10` — the shape that once rendered `10.00 SAR`.
    // It must stay a definition phrase: `10 off`, never a money-shaped figure.
    const shortfall = guidanceView([GET_SHORTFALL]).cards[0]
    expect(shortfall.arms).toHaveLength(2)
    expect(say(shortfall.arms[1].discount)).toBe('10 off')
    for (const figure of figuresIn(produced(shortfall))) expect(MONEY_SHAPED(figure), figure).toBe(false)
    // …and the same with a set-price arm and a grouping arm, the other two
    // shapes that carry a figure of their own.
    const varied = guidanceView([
      {
        ...GET_SHORTFALL,
        rewards: [
          { armId: '1', kind: 'grouping', groupingId: 'G-1', eligibleCount: 42, have: 0, need: 1, discount: { discountType: 'P', value: 29.95, quantity: 2 } },
          { armId: '2', kind: 'material', materialNumber: '500062', have: 0, need: 2, discount: { discountType: 'R', value: 30 } },
        ],
      },
    ]).cards[0]
    for (const figure of figuresIn(produced(varied))) expect(MONEY_SHAPED(figure), figure).toBe(false)
  })

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
    // meter's counts, the delta still needed and the eligible population. `wouldSave`
    // does not exist on the wire and no client-side equivalent may replace it
    // (spec 574 US26), so a future caller must not find a field to print.
    const allowed = new Set(['have', 'need', 'stillNeeded', 'count', 'eligible'])
    // GET_SHORTFALL brings the reward arms under the same walk (414, W10).
    for (const c of guidanceView([
      ...NEAR_MISS_CLASSES,
      miss({ discount: { discountType: '%', value: 20 } }),
      GET_SHORTFALL,
    ]).cards) {
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
  })

  it('opens NOTHING by default over these two, because neither is reachable', () => {
    // 🚩 The v1.10 re-capture changed this answer, and correctly. Both captured
    // offers are `kind: 'coupon'` now that the server states the fourth kind —
    // so there is no actionable card, and the card that opens by construction
    // (171) is the top-ranked ACTIONABLE one. An offer no basket change reaches
    // must not be the thing the strip opens itself on.
    expect(view.openByDefault).toBeNull()
    expect(view.cards.filter((c) => c.cardId === view.openByDefault)).toHaveLength(0)
    // The illustration still has one, so this is the capture's own shape rather
    // than the rule going missing.
    expect(guidanceView(NEAR_MISS_CLASSES).openByDefault).not.toBeNull()
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
    // 🚩 **This is 189's central claim, and it is no longer a hypothesis.** The
    // v1.10 re-capture answers `kind: "coupon"` on both of this store's offers
    // — `10% Coupon` and `T173 COUPON-GATED BBY` — where the earlier capture
    // said `material` and the strip therefore drew *add 1 more* with 172's
    // one-click add behind it. That add would have qualified the bonus buy
    // while burning nothing (the server now refuses it by name,
    // `ITEM_NOT_SELLABLE`, capture 14).
    expect(NEAR_MISSES.map((m) => m.prereq?.kind)).toEqual(['coupon', 'coupon'])
    expect(view.cards.map((c) => c.klass)).toEqual(['needsCoupon', 'needsCoupon'])
  })

  it('counts NONE of them as within reach, off the wire’s own bytes', () => {
    // The top bar's number means *offers the agent can reach by putting
    // something in the basket*. Neither of these is one, and inflating the
    // count is how an agent ends up hunting for an item that would not help.
    expect(view.withinReachCount).toBe(0)
    expect(view.actionable).toHaveLength(0)
    // And they are not buried as unavailable either: they are real, and the
    // caller may be holding the coupon.
    expect(view.unavailable).toHaveLength(0)
    expect(view.needsCoupon).toHaveLength(2)
  })

  it('says nothing about a SET over an offer no basket change reaches', () => {
    // 🚩 The set sentence and the eligible population belong to the actionable
    // class alone — they are the answer to *what do I add*, and there is no add
    // here. Since the re-capture there is no captured `kind: 'material'` left
    // anywhere on the map, so US42's material leg is proved over the
    // illustration below, where it still has an input.
    for (const c of view.cards) {
      expect(say(c.set)).toBeNull()
      expect(c.eligible).toBeNull()
    }
  })

  it('states a one-material prerequisite as that item, never as a selection', () => {
    // US42's rule runs both ways: a set sentence about exactly one item would
    // say *any 1 from this selection* of a thing the caller has no selection
    // over. ⚠ Its fixture is the illustration — see above for why.
    const material = guidanceView([
      { ...NEAR_MISS_CLASSES[0], prereq: { kind: 'material', materialNumber: 'T173', eligibleCount: 1 } },
    ])
    expect(say(material.cards[0].set)).toBe('1 more of this item')
    expect(material.cards[0].eligible).toBe(1)
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
        String(c.stillNeeded),
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
    expect(guidanceView([couponGated()]).withinReachCount).toBe(0)
  })

  it('is never the card that opens by default', () => {
    expect(guidanceView([couponGated()]).openByDefault).toBeNull()
  })

  it('is not filed as unavailable either — it is real and reachable', () => {
    // With a coupon it fires. Burying it with the origin-filtered and
    // out-of-window offers would tell the agent it cannot happen.
    expect(guidanceView([couponGated()]).unavailable).toHaveLength(0)
  })

  it('is the ONLY kind treated as unreachable — a fifth one degrades, never guesses', () => {
    // 🚩 The kinds are the SERVER's list and it has already grown once. A kind
    // this client has never heard of must not be filed as coupon-gated (which
    // would state a coupon the caller does not need) and must not throw: it
    // keeps the pre-v1.10 answer, which is the class its own projection states.
    const future = guidanceView([
      { ...couponGated(), prereq: { kind: 'segment' as never, eligibleCount: 3 } },
    ])
    expect(future.cards[0].klass).toBe('actionable')
    expect(future.needsCoupon).toHaveLength(0)
    // …and it says nothing about a set it cannot describe.
    expect(future.cards[0].set).toBeNull()
  })

  it('still yields to a skipReason — an offer that was never evaluated is not an offer', () => {
    const view = guidanceView([{ ...couponGated(), skipReason: 'ORIGIN_FILTERED' }])
    expect(view.cards[0].klass).toBe('unavailable')
    expect(view.needsCoupon).toHaveLength(0)
  })
})

/**
 * Spec 412 / ticket 413 — the **get-side shortfall**: an offer that QUALIFIED and
 * whose reward has nothing to land on.
 *
 * The corpus is `GET_SHORTFALL`, the provisional staging fragment (BO-1 unfiled):
 * bonus buy 803, coupon `SS222` redeemed, two reward arms joined by OR, neither in
 * the basket. Before this ticket the strip told the agent *this offer needs a
 * coupon* about it — the coupon they had just applied.
 */
describe('aShortfallIsDrawnAsQualifiedWhateverItsReadyFlagSays', () => {
  it('classes the staging fixture as a shortfall, never counted or needsCoupon', () => {
    const view = guidanceView([GET_SHORTFALL])
    expect(view.cards[0].klass).toBe('shortfall')
    expect(view.shortfall).toHaveLength(1)
    expect(view.counted).toHaveLength(0)
    expect(view.needsCoupon).toHaveLength(0)
    expect(view.actionable).toHaveLength(0)
    expect(view.unavailable).toHaveLength(0)
  })

  it('carries the qualified statement, and nothing that says ready, counted or needs a coupon', () => {
    const shortfall = guidanceView([GET_SHORTFALL]).cards[0]
    const words = say(shortfall.qualified)
    expect(words).toMatch(/qualified/i)
    expect(words).toMatch(/waiting for a reward product/i)
    expect(words).not.toMatch(/already counted|needs? a coupon|ready/i)
    // No action of the prerequisite's: the buy side is complete, so a delta or a
    // set statement would read as *more of the prerequisite*.
    expect(shortfall.stillNeeded).toBe(0)
    expect(shortfall.set).toBeNull()
    expect(shortfall.eligible).toBeNull()
    expect(shortfall.reason).toBeNull()
  })

  it('is a shortfall whatever isReady says — the flag is asked before the ready flag', () => {
    // W3 makes `isReady` false on a shortfall, but the class must not hang on it:
    // a server that sends both still describes an offer whose reward has no target.
    expect(guidanceView([{ ...GET_SHORTFALL, isReady: true }]).cards[0].klass).toBe('shortfall')
  })

  it('degrades to the qualified statement alone when the arms are absent (W11)', () => {
    const bare: NearMiss = { ...GET_SHORTFALL, rewards: undefined, rewardLink: undefined, couponsSpent: undefined }
    const card = guidanceView([bare]).cards[0]
    expect(card.klass).toBe('shortfall')
    expect(say(card.qualified)).toMatch(/waiting for a reward product/i)
  })

  it('puts no money-shaped figure in the region', () => {
    const card = guidanceView([GET_SHORTFALL]).cards[0]
    const produced = [...Object.values(card.qualified?.params ?? {}).map(String), say(card.qualified) ?? '']
    for (const figure of produced)
      expect(/(?:SAR|SR)\s*\d|\d\s*(?:SAR|SR)\b|\d+\.\d{2}/.test(figure), figure).toBe(false)
  })
})

describe('theOtherClassesKeepTheirWords', () => {
  it('skipped beats shortfall — an offer never evaluated is not an offer', () => {
    const view = guidanceView([{ ...GET_SHORTFALL, skipReason: 'ORIGIN_FILTERED' }])
    expect(view.cards[0].klass).toBe('unavailable')
    expect(view.cards[0].qualified).toBeNull()
    expect(view.shortfall).toHaveLength(0)
  })

  it('an UNMET coupon is still needsCoupon', () => {
    // The capture's own two coupon offers, `have 0 / need 1`.
    expect(guidanceView(NEAR_MISSES).cards.map((c) => c.klass)).toEqual(['needsCoupon', 'needsCoupon'])
  })

  it('a MET coupon on a non-shortfall falls through to counted — and never grows an add', () => {
    // W4: a coupon already on the order can never produce *needs a coupon*.
    const metCoupon: NearMiss = { ...GET_SHORTFALL, getShortfall: undefined, rewards: undefined }
    expect(guidanceView([{ ...metCoupon, isReady: true }]).cards[0].klass).toBe('counted')
    // 🚩 Not ready and unflagged is a server contradicting itself. It must still
    // not become actionable: that card's add is an add of the prerequisite, the
    // campaign voucher (159), which qualifies the bonus buy while burning nothing.
    const contradicted = guidanceView([{ ...metCoupon, isReady: false }])
    expect(contradicted.cards[0].klass).toBe('counted')
    expect(contradicted.actionable).toHaveLength(0)
    expect(contradicted.withinReachCount).toBe(0)
  })

  it('an out-ranked offer is still counted', () => {
    expect(guidanceView([NEAR_MISS_CLASSES[1]]).cards[0].klass).toBe('counted')
  })

  it('a v1.11 projection (no new fields) classifies exactly as before', () => {
    expect(guidanceView(NEAR_MISS_CLASSES).cards.map((c) => c.klass)).toEqual(['actionable', 'counted', 'unavailable'])
    // An explicit `false` is the same answer as an absent flag.
    for (const corpus of [NEAR_MISS_CLASSES, NEAR_MISSES]) {
      expect(guidanceView(corpus.map((m) => ({ ...m, getShortfall: false })))).toEqual(guidanceView(corpus))
      for (const c of guidanceView(corpus).cards) expect(c.qualified).toBeNull()
    }
  })

  it('leaves the price check’s cards unchanged — its wire never carries the flag', () => {
    const row = searchRowView({
      materialNumber: '200021',
      descriptionEn: 'X',
      descriptionAr: 'X',
      estimatePriceExVat: 1,
      atp: 1,
    })
    const before = priceCheckPanel({ canPriceCheck: true, row, result: PRICE_CHECK })
    // Even a server that DID put it on a price-check offer reaches no card:
    // `offerCards` maps its fields one by one.
    const flagged = { ...PRICE_CHECK, offers: PRICE_CHECK.offers.map((o) => ({ ...o, getShortfall: true })) }
    expect(priceCheckPanel({ canPriceCheck: true, row, result: flagged })).toEqual(before)
    if (before.kind !== 'quoted') throw new Error('not quoted')
    for (const offer of before.offers) {
      expect(offer.klass).not.toBe('shortfall')
      expect(offer.qualified).toBeNull()
    }
  })
})

describe('shortfallCardsRankFirstAndCount', () => {
  const [ACTIONABLE, COUNTED, SKIPPED] = NEAR_MISS_CLASSES
  const SECOND: NearMiss = { ...GET_SHORTFALL, offerId: 'BBY-9002', description: 'Shampoo + conditioner at 50%' }
  const view = guidanceView([ACTIONABLE, COUNTED, GET_SHORTFALL, SKIPPED, SECOND])

  it('lists shortfall cards in the server order among themselves', () => {
    expect(view.shortfall.map((c) => c.offerId)).toEqual(['000100000803', 'BBY-9002'])
    // `cards` is still the engine's own order — the rank is the strip's to draw.
    expect(view.cards.map((c) => c.offerId)).toEqual([
      'BBY-5510',
      'BBY-5602',
      '000100000803',
      'BBY-6120',
      'BBY-9002',
    ])
  })

  it('counts them in the top-bar count, beside the actionable ones', () => {
    expect(view.withinReachCount).toBe(3)
    expect(view.actionable.map((c) => c.offerId)).toEqual(['BBY-5510'])
  })

  it('opens the top shortfall card by default, even with an actionable card above it', () => {
    expect(view.openByDefault).toBe('000100000803')
    // …and falls back to the actionable rule where there is none.
    expect(guidanceView([ACTIONABLE, COUNTED]).openByDefault).toBe('BBY-5510')
  })
})

/**
 * Ticket 414 — the shortfall card names what the reward is waiting for: one row
 * per reward arm with that arm's OWN discount, the get-side link, and the coupon
 * the order has already spent on it.
 *
 * Corpus: `GET_SHORTFALL`, staging's bonus buy 803 — arms `500061` (20%) OR
 * `500062` (10 off), neither in the basket, coupon `SS222` spent.
 */
describe('eachRewardArmIsItsOwnRowWithItsOwnDiscount', () => {
  const arm = (over: Partial<NonNullable<NearMiss['rewards']>[number]>) => ({
    armId: '1',
    kind: 'material',
    materialNumber: '500061',
    have: 0,
    need: 1,
    discount: { discountType: '%', value: 20 },
    ...over,
  })
  const withArms = (rewards: NonNullable<NearMiss['rewards']>) => guidanceView([{ ...GET_SHORTFALL, rewards }]).cards[0]

  it('draws the staging fixture as two rows in armId order, each with its own discount', () => {
    const { arms } = guidanceView([GET_SHORTFALL]).cards[0]
    expect(arms.map((a) => a.armId)).toEqual(['1', '2'])
    expect(arms.map((a) => say(a.subject))).toEqual(['Item 500061', 'Item 500062'])
    expect(arms.map((a) => say(a.discount))).toEqual(['20% off', '10 off'])
    expect(arms.map((a) => a.met)).toEqual([false, false])
  })

  it('orders by armId, not by the wire’s order — and numerically', () => {
    const arms = withArms([arm({ armId: '10' }), arm({ armId: '2' }), arm({ armId: '1' })]).arms
    expect(arms.map((a) => a.armId)).toEqual(['1', '2', '10'])
  })

  it('reads a grouping arm as a set — any 1 of N — never as one item', () => {
    const [grouping] = withArms([arm({ kind: 'grouping', materialNumber: undefined, groupingId: 'G-77', eligibleCount: 42 })]).arms
    expect(say(grouping.subject)).toMatch(/any 1\b/)
    expect(say(grouping.subject)).toMatch(/42/)
    // No population on the wire ⇒ the set phrase without one, never a guessed N.
    const [bare] = withArms([arm({ kind: 'grouping', materialNumber: undefined, groupingId: 'G-77' })]).arms
    expect(say(bare.subject)).toMatch(/any 1\b/)
    expect(say(bare.subject)).not.toMatch(/qualify/)
  })

  it('counts a material arm that needs more than one', () => {
    const [two] = withArms([arm({ need: 2 })]).arms
    expect(say(two.subject)).toMatch(/2/)
    expect(say(two.subject)).toMatch(/500061/)
  })

  it('never marks an arm met on a requirement the wire did not state', () => {
    const arms = withArms([arm({ armId: '1', have: 1, need: 0 }), arm({ armId: '2', have: 1, need: undefined as unknown as number })]).arms
    expect(arms.map((a) => a.met)).toEqual([false, false])
  })

  it('marks an arm met when have ≥ need, and only then', () => {
    const arms = withArms([arm({ armId: '1', have: 1, need: 1 }), arm({ armId: '2', have: 3, need: 2 }), arm({ armId: '3', have: 1, need: 2 })]).arms
    expect(arms.map((a) => a.met)).toEqual([true, true, false])
  })

  it('an arm with no discount the rule can word still names its product', () => {
    const [plain] = withArms([arm({ discount: null })]).arms
    expect(plain.discount).toBeNull()
    expect(say(plain.subject)).toBe('Item 500061')
  })

  it('an arm of unknown kind names nothing it cannot say (W11)', () => {
    const [unknown] = withArms([arm({ kind: 'hierarchy', materialNumber: '500061', groupingId: 'H-1' })]).arms
    const words = say(unknown.subject) ?? ''
    expect(words).not.toMatch(/500061|H-1|hierarchy/)
    expect(words).toMatch(/reward product/i)
    // A material arm the wire named no material for is the same case.
    const [nameless] = withArms([arm({ materialNumber: undefined })]).arms
    expect(say(nameless.subject)).toBe(words)
  })

  it('draws no arms where the wire sent none, nor on any other class', () => {
    expect(guidanceView([{ ...GET_SHORTFALL, rewards: undefined }]).cards[0].arms).toEqual([])
    for (const c of guidanceView([...NEAR_MISS_CLASSES, ...NEAR_MISSES]).cards) expect(c.arms).toEqual([])
    // A skipped offer carrying arms is still not a shortfall, and draws none.
    expect(guidanceView([{ ...GET_SHORTFALL, skipReason: 'ORIGIN_FILTERED' }]).cards[0].arms).toEqual([])
  })
})

describe('theLinkAndTheSpentCouponAreStated', () => {
  const shortfall = (over: Partial<NearMiss>) => guidanceView([{ ...GET_SHORTFALL, ...over }]).cards[0]

  it('says *any one* under OR and *one of each* under AND', () => {
    expect(say(shortfall({ rewardLink: 'any' }).rewardLink)).toBe('Add any one')
    expect(say(shortfall({ rewardLink: 'each' }).rewardLink)).toBe('Add one of each')
  })

  it('draws no header when the wire omits the link, or sends one it does not know', () => {
    expect(shortfall({ rewardLink: undefined }).rewardLink).toBeNull()
    expect(shortfall({ rewardLink: 'some' as NearMiss['rewardLink'] }).rewardLink).toBeNull()
  })

  it('draws no header over no rows — a link between arms the card cannot show says nothing', () => {
    expect(shortfall({ rewards: undefined }).rewardLink).toBeNull()
    expect(shortfall({ rewards: [] }).rewardLink).toBeNull()
  })

  it('states the spent coupon by its code, and that it gives nothing until a reward product is added', () => {
    const words = say(shortfall({}).spentCoupons) ?? ''
    expect(words).toMatch(/SS222/)
    expect(words).toMatch(/spent on this order/i)
    expect(words).toMatch(/nothing until a reward product is added/i)
  })

  it('pluralises for two codes', () => {
    const words = say(shortfall({ couponsSpent: ['SS222', 'AB777'] }).spentCoupons) ?? ''
    expect(words).toMatch(/SS222/)
    expect(words).toMatch(/AB777/)
    expect(words).toMatch(/^Coupons /)
    expect(words).toMatch(/\bare already spent/)
    expect(say(shortfall({}).spentCoupons)).toMatch(/^Coupon SS222 is already spent/)
  })

  it('still states the spent coupon when the wire sent no arms — the coupon is spent either way', () => {
    // 🚩 A ruling against the ticket's literal *413's statement only*: W7 is
    // unconditional, and the coupon is the caller's loss (US11) arms or none.
    const bare = shortfall({ rewards: undefined, rewardLink: undefined })
    expect(bare.arms).toEqual([])
    expect(bare.rewardLink).toBeNull()
    expect(say(bare.spentCoupons)).toMatch(/SS222/)
  })

  it('has no line without couponsSpent — absent, empty, or blank codes', () => {
    expect(shortfall({ couponsSpent: undefined }).spentCoupons).toBeNull()
    expect(shortfall({ couponsSpent: [] }).spentCoupons).toBeNull()
    expect(shortfall({ couponsSpent: ['', '  '] }).spentCoupons).toBeNull()
  })

  it('is said on no other class — a coupon line belongs to the shortfall card alone', () => {
    for (const c of guidanceView([...NEAR_MISS_CLASSES, ...NEAR_MISSES]).cards) {
      expect(c.rewardLink).toBeNull()
      expect(c.spentCoupons).toBeNull()
    }
  })
})
