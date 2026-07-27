import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import type { FiredPromotion, NearMiss, SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION, NEAR_MISSES, PREREQ_RESOLUTION } from './__fixtures__/payloads'
import { classifyAdd, type AddOutcome } from './add-outcome'
import { guidanceView } from './guidance-view'
import { prereqRows, restOfSet } from './prereq-view'

/**
 * Ticket 172 — the one-click add, and saying what happened.
 *
 * The states are the contract's own fixtures moved one step: fixture 02's order
 * carrying fixture 03's near-misses, and the same pair after an add. Values are
 * illustrative by rule (CONTRACT.md §11); what is asserted is the SHAPE of a
 * difference between two projections.
 */

/** The fixture's buy-side near-miss — the card an add is launched from. */
const [ACTIONABLE] = NEAR_MISSES

const state = (over: { nearMisses?: NearMiss[]; firedPromotions?: FiredPromotion[] }): SessionState => ({
  ...ATTACHED_SESSION,
  nearMisses: over.nearMisses ?? NEAR_MISSES,
  firedPromotions: over.firedPromotions ?? [],
})

/** The same near-miss with its meter moved — the did-not-fire case's whole
 *  content: the prerequisite was one of several, so the offer stays. */
const advanced = (have: number, need = 2): NearMiss[] => [
  { ...ACTIONABLE, progress: { have, need } },
  ...NEAR_MISSES.slice(1),
]

const fired = (offerId: string, description: string): FiredPromotion => ({
  offerId,
  description,
  amount: -8.4,
  lineIds: ['L1'],
})

const ADD = { offerId: ACTIONABLE.offerId, itemNumber: '200145', itemName: 'Oral-B Toothpaste 100ml' }

/** What the agent actually reads, resolved through the REAL i18n — a key shape
 *  proves nothing about whether the sentence says what happened. */
const say = (outcome: AddOutcome) => i18n.t(outcome.phrase.key, outcome.phrase.params)

describe('anAddIsClassifiedByWhatTheEngineDid', () => {
  it('reads an offer that moved to the fired list as fired', () => {
    const before = state({})
    const after = state({
      nearMisses: NEAR_MISSES.slice(1),
      firedPromotions: [fired(ACTIONABLE.offerId, ACTIONABLE.description)],
    })
    const outcome = classifyAdd(before, after, ADD)
    expect(outcome.kind).toBe('fired')
    expect(say(outcome)).toBe('Added — this offer applied.')
    // The offer's own words, carried as data for the banner to draw beside the
    // sentence — never glued into it (the region's money rule).
    expect(outcome.offerDescription).toBe(ACTIONABLE.description)
  })

  it('names the offer that fired INSTEAD', () => {
    // 🚩 The re-price is the engine's: a better offer can take the item the card
    // asked for. The agent is about to quote a figure, so it is named.
    const after = state({
      nearMisses: advanced(2),
      firedPromotions: [fired('BBY-9900', 'SAR 15 off two — oral care')],
    })
    const outcome = classifyAdd(state({}), after, ADD)
    expect(outcome.kind).toBe('firedOther')
    expect(say(outcome)).toBe('Added. A better offer fired instead:')
    expect(outcome.offerDescription).toBe('SAR 15 off two — oral care')
  })

  it('keeps the offer, with its meter advanced, when nothing fired', () => {
    // 138's third state, and the one silence breaks: the prerequisite was one of
    // several. Removing the card here reads as a bug; saying nothing reads as a
    // broken button.
    const outcome = classifyAdd(state({}), state({ nearMisses: advanced(2, 3) }), ADD)
    expect(outcome.kind).toBe('didNotFire')
    expect(outcome.progress).toEqual({ from: { have: 1, need: 2 }, to: { have: 2, need: 3 } })
    expect(outcome.stillNeeds).toBe(1)
    expect(say(outcome)).toBe('Added — this offer still needs 1 more.')
    // 🚩 And the card is still THERE — the view model the strip draws still
    // holds it, actionable, with the advanced meter.
    const view = guidanceView(advanced(2, 3))
    expect(view.cards[0].klass).toBe('actionable')
    expect(view.cards[0].progress).toEqual({ have: 2, need: 3 })
  })

  it('does not credit the add with an offer that had already fired', () => {
    // *Fired* means NEWLY fired. An offer already in the list before the press
    // was not fired by it.
    const already = [fired(ACTIONABLE.offerId, ACTIONABLE.description)]
    const outcome = classifyAdd(
      state({ firedPromotions: already }),
      state({ nearMisses: advanced(2, 3), firedPromotions: already }),
      ADD,
    )
    expect(outcome.kind).toBe('didNotFire')
  })

  it('still says something when the offer left the list without firing', () => {
    // An under-populated or re-projected answer is not a reason to say nothing:
    // the agent pressed a button and the basket moved.
    const outcome = classifyAdd(state({}), state({ nearMisses: NEAR_MISSES.slice(1) }), ADD)
    expect(outcome.kind).toBe('didNotFire')
    expect(outcome.progress).toBeNull()
    expect(say(outcome)).toBe('Added — this offer has not fired.')
  })

  it('carries what was added, as data rather than as a sentence', () => {
    // 🚩 The console's own phrase takes a COUNT and nothing else. The item's
    // name and the offer's description are server text — real descriptions carry
    // currency words, and a region that guarantees *no figure formatted as
    // money* cannot make that guarantee about a sentence it glued them into.
    for (const outcome of [
      classifyAdd(state({}), state({ nearMisses: advanced(2, 3) }), ADD),
      classifyAdd(
        state({}),
        state({ firedPromotions: [fired(ACTIONABLE.offerId, ACTIONABLE.description)] }),
        ADD,
      ),
    ]) {
      expect(outcome.itemName).toBe(ADD.itemName)
      expect(outcome.itemNumber).toBe(ADD.itemNumber)
      expect(outcome.offerId).toBe(ADD.offerId)
      for (const value of Object.values(outcome.phrase.params)) expect(typeof value).toBe('number')
      expect(say(outcome)).not.toContain(ADD.itemName)
    }
  })
})

/**
 * The qualifying rows — 138's *a grouping is a set, not an item*, and the ruling
 * that made carrying Arabic cost zero pixels.
 */
describe('theQualifyingHandfulIsTheServersOwn', () => {
  const rows = prereqRows(PREREQ_RESOLUTION)

  it('draws every row the server ranked, and slices none of them', () => {
    // 🚩 Three is the number (138 finding 1) and it is the SERVER's `topN`: a
    // client slice of a server ranking is a second opinion about which three are
    // worth showing. Given five, five come out.
    expect(rows.map((row) => row.itemNumber)).toEqual(PREREQ_RESOLUTION.items.map((item) => item.itemNumber))
    const wider = { ...PREREQ_RESOLUTION, items: [...PREREQ_RESOLUTION.items, ...PREREQ_RESOLUTION.items] }
    expect(prereqRows(wider)).toHaveLength(6)
  })

  it('carries the Arabic name on the META line, beside the number and the estimate', () => {
    const meta = rows[0].meta.map((part) => part.id)
    expect(meta).toEqual(['itemNumber', 'description2', 'estimate'])
    expect(rows[0].meta[1].text).toBe('معجون أسنان')
    // The estimate is marked as one and carries no currency word — `SAR` is
    // reserved for engine money, and this row holds none.
    expect(rows[0].meta[2].text).toBe('≈9.13')
  })

  it('keeps unknown availability distinct from none', () => {
    // The third row's `atp: null` is a degraded stock read on a 200. It is still
    // offered — unknown availability has never gated order entry.
    expect(rows.map((row) => row.availability.kind)).toEqual(['count', 'count', 'unknown'])
    expect(rows[2].availability.quantity).toBeNull()
  })

  it('routes to the rest of the set rather than listing it', () => {
    // 42 qualify, three are drawn: the other 39 are a hand-off to the item
    // search, never a second list.
    const rest = restOfSet(PREREQ_RESOLUTION, 42)
    expect(i18n.t(rest!.key, rest!.params)).toBe('Search the other 39 — filtered to this offer')
    // A population that disagrees with `truncated` does not silence the route:
    // the server said it held rows back, so the route is offered — without a
    // figure, rather than with one the two halves of the wire contradict.
    expect(i18n.t(restOfSet(PREREQ_RESOLUTION, 3)!.key)).toBe(
      'Search the rest of the selection — filtered to this offer',
    )
    // A population the wire did not state is not invented either.
    expect(i18n.t(restOfSet(PREREQ_RESOLUTION, null)!.key)).toBe(
      'Search the rest of the selection — filtered to this offer',
    )
    // 🚩 And `truncated` is what says there IS a rest. The set is
    // availability-filtered, so 42 qualifying against three drawn does not mean
    // 39 are waiting: on an untruncated answer the server gave everything it
    // had, and the route would send the agent after rows it withheld.
    expect(restOfSet({ ...PREREQ_RESOLUTION, truncated: false }, 42)).toBeNull()
    expect(restOfSet({ ...PREREQ_RESOLUTION, truncated: false }, null)).toBeNull()
    expect(restOfSet(undefined, 42)).toBeNull()
  })

  it('takes the population from the card, which takes it from the wire', () => {
    // The two halves meet here: `eligibleCount` rides the near-miss (§3.1) and
    // the items ride the resolution (§3.3) — the same population, so the card
    // holds the figure the route subtracts from.
    expect(guidanceView(NEAR_MISSES).cards[0].eligible).toBe(42)
    expect(guidanceView(NEAR_MISSES).cards[1].eligible).toBeNull()
  })
})
