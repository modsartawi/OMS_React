import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import i18n from '@/core/i18n'
import type { StockElsewhereResult, StockElsewhereStore } from '@/core/models/callcenter'
import { stockView, type StockPanel } from './stock-view'

/**
 * Ticket 186 — the *about this item* panel's stock half, as rules rather than as
 * markup.
 *
 * ⚠ **There is no capture for this read, deliberately** (BackOffice 876: §11's
 * captures are round trips against live services, and this one's second hop is a
 * remote stock service the test host cannot reach — a scenario that could only
 * ever record `available: false` would commit an outage as the contract's shape).
 * So the corpus here is hand-authored to §3.5's documented shape, and every case
 * asserts a RULE over that shape; not one of them reads a value as evidence of
 * what the stock service does.
 *
 * The three rules this file exists for are the ones a component cannot be trusted
 * with, because each is a rule about what must **not** happen:
 *
 *   • `available: false` is *we could not check* and must never collapse into
 *     *nobody has it* — two sentences an agent says down a phone with opposite
 *     consequences;
 *   • `distanceKnown: false` is an honestly UNRANKED list, never a plausible one;
 *   • a `null` row distance draws blank and the store still appears.
 */

const STORE = (over: Partial<StockElsewhereStore> = {}): StockElsewhereStore => ({
  plant: '1204',
  city: 'Riyadh',
  areaName: 'North Riyadh',
  address: 'King Abdullah Rd',
  atp: 6,
  distanceKm: 4.2,
  ...over,
})

const RESULT = (over: Partial<StockElsewhereResult> = {}): StockElsewhereResult => ({
  contractVersion: '1.7',
  itemNumber: '200021',
  originPlant: '1101',
  distanceKnown: true,
  available: true,
  stores: [STORE()],
  withStock: 1,
  truncated: false,
  ...over,
})

/** The panel over a settled answer, with the gate open — the shape every case
 *  below varies one field of. */
const view = (result: StockElsewhereResult | null, over: Partial<Parameters<typeof stockView>[0]> = {}) =>
  stockView({ canPriceCheck: true, result, pending: false, ...over })

/** A §7 refusal as `core/api` really throws it — the code lives in `details[0]`,
 *  which is where `apiErrorCode` reads it from. */
const refusal = (code: string) =>
  new ApiError('business', 'server sentence', 409, [
    { errorCode: code, internalErrorCode: null, errorMessage: '' },
  ] as never)

/** Narrow to the listed arm, so a case about rows cannot silently pass over a
 *  state that has no rows at all. */
const listed = (panel: StockPanel) => {
  expect(panel.kind).toBe('listed')
  return panel as Extract<StockPanel, { kind: 'listed' }>
}

describe('stockView — the three-way answer (Proof 1)', () => {
  it('a store with stock is a count, in the search row own ATP definition', () => {
    const panel = listed(view(RESULT({ stores: [STORE({ atp: 6 })], withStock: 1 })))
    expect(panel.rows).toHaveLength(1)
    expect(panel.rows[0].atp).toBe(6)
  })

  it('🚩 available:false is *we could not check* — never *nobody has it*', () => {
    // The hop did not answer. The wire sends an EMPTY list with it, which is
    // exactly the input a careless reading turns into the second sentence.
    const panel = view(RESULT({ available: false, stores: [], withStock: 0 }))
    expect(panel.kind).toBe('unknown')
  })

  it('🚩 and an available:false answer carrying rows is STILL unknown', () => {
    // A partial answer from a hop that told us it failed is not a list an agent
    // may read down a phone: *these are the stores that have it* would be a claim
    // the server just withdrew. `available` outranks the rows, always.
    const panel = view(RESULT({ available: false, stores: [STORE()], withStock: 1 }))
    expect(panel.kind).toBe('unknown')
  })

  it('an answered read with no store is *nobody else has it*', () => {
    const panel = view(RESULT({ available: true, stores: [], withStock: 0, truncated: false }))
    expect(panel.kind).toBe('none')
  })

  it('🚩 the two sentences are different states, so neither can be drawn by the other branch', () => {
    // The guarantee said as a property: no input produces a panel that is both,
    // and the *unknown* arm carries no rows field for a list to leak into.
    const unknown = view(RESULT({ available: false, stores: [STORE()] }))
    expect(unknown).toEqual({ kind: 'unknown' })
    expect(view(RESULT({ stores: [], withStock: 0 })).kind).not.toBe('unknown')
  })
})

describe('stockView — an unlocatable origin is unranked, not wrong (Proof 2)', () => {
  const UNRANKED = RESULT({
    distanceKnown: false,
    stores: [
      STORE({ plant: '1301', distanceKm: null }),
      STORE({ plant: '1102', distanceKm: null }),
      STORE({ plant: '1204', distanceKm: null }),
    ],
    withStock: 3,
  })

  it('🚩 the list is ordered by store code', () => {
    const panel = listed(view(UNRANKED))
    expect(panel.rows.map((r) => r.plant)).toEqual(['1102', '1204', '1301'])
  })

  it('🚩 and it says so — an unranked list that does not announce itself reads as nearest-first', () => {
    expect(listed(view(UNRANKED)).unranked).toBe(true)
  })

  it('a ranked list is left exactly as the server ranked it', () => {
    // The server ranked from the order's own plant; re-sorting here would be a
    // second definition of nearest on a screen whose value is agreeing with the
    // till.
    const ranked = RESULT({
      stores: [STORE({ plant: '1301', distanceKm: 1.1 }), STORE({ plant: '1102', distanceKm: 9.4 })],
      withStock: 2,
    })
    const panel = listed(view(ranked))
    expect(panel.rows.map((r) => r.plant)).toEqual(['1301', '1102'])
    expect(panel.unranked).toBe(false)
  })

  it('🚩 the ordering is by CODE, ordinally — a letter code sorts the same everywhere', () => {
    // `BZ01` is a real dev-estate plant with no coordinate (876's discharged
    // deployment obligation), so mixed letter/digit codes are not hypothetical,
    // and a locale-dependent collation would make *by store code* mean different
    // sequences in different runtimes.
    const mixed = RESULT({
      distanceKnown: false,
      stores: [STORE({ plant: 'BZ01' }), STORE({ plant: '1102' }), STORE({ plant: 'Z001' })],
      withStock: 3,
    })
    expect(listed(view(mixed)).rows.map((r) => r.plant)).toEqual(['1102', 'BZ01', 'Z001'])
  })

  it('🚩 a distance is never invented for an unranked list', () => {
    expect(listed(view(UNRANKED)).rows.every((r) => r.distanceKm === null)).toBe(true)
  })
})

describe('stockView — an unknown distance is a value, never a missing store (Proof 3)', () => {
  it('🚩 a null distance row is kept, and kept in its ranked place', () => {
    const mixed = RESULT({
      stores: [
        STORE({ plant: '1204', distanceKm: 4.2 }),
        STORE({ plant: '1305', distanceKm: null }),
        STORE({ plant: '1409', distanceKm: 12.8 }),
      ],
      withStock: 3,
    })
    const panel = listed(view(mixed))
    expect(panel.rows.map((r) => r.plant)).toEqual(['1204', '1305', '1409'])
  })

  it('🚩 and its distance stays null — never 0, which reads as *here*', () => {
    const panel = listed(view(RESULT({ stores: [STORE({ distanceKm: null })] })))
    expect(panel.rows[0].distanceKm).toBeNull()
  })
})

describe('stockView — the honest total, and the cap', () => {
  it('a capped list carries the total that was NOT capped', () => {
    const panel = listed(
      view(RESULT({ stores: [STORE(), STORE({ plant: '1305' })], withStock: 23, truncated: true })),
    )
    expect(panel.truncated).toBe(true)
    expect(panel.withStock).toBe(23)
    expect(panel.rows).toHaveLength(2)
  })

  it('🚩 a count line may never out-claim its own list', () => {
    // The one thing reconciled rather than trusted. `truncated` is DEFINED as
    // `withStock > stores.length`, so an answer that disagrees with its own
    // definition would otherwise print *23 stores with stock* above three rows —
    // a claim about twenty stores the agent cannot name, made by the panel and
    // not by the server.
    const panel = listed(view(RESULT({ stores: [STORE()], withStock: 23, truncated: false })))
    expect(panel.truncated).toBe(true)
    expect(panel.withStock).toBe(23)
  })

  it('and an honest small answer is left alone', () => {
    const panel = listed(view(RESULT({ stores: [STORE()], withStock: 1, truncated: false })))
    expect(panel.truncated).toBe(false)
  })

  it('🚩 nothing here re-caps or re-counts the server answer', () => {
    // `withStock` is the count BEFORE the cap; deriving it from `rows.length`
    // would turn *23 stores have it* into *2 do*.
    const panel = listed(view(RESULT({ stores: [STORE()], withStock: 23, truncated: true })))
    expect(panel.withStock).not.toBe(panel.rows.length)
  })
})

describe('stockView — the gate, the wait and the refusal', () => {
  it('a shut gate is shut — the same predicate the price half reads', () => {
    expect(view(RESULT(), { canPriceCheck: false })).toEqual({ kind: 'shut' })
    expect(view(RESULT(), { canPriceCheck: undefined })).toEqual({ kind: 'shut' })
  })

  it('a read in flight is pending, and carries no list', () => {
    expect(view(null, { pending: true })).toEqual({ kind: 'pending' })
  })

  it('🚩 a refusal is read before a stale success — as the price half reads it', () => {
    const panel = stockView({
      canPriceCheck: true,
      result: RESULT(),
      error: refusal('STORE_NOT_CHOSEN'),
      pending: false,
    })
    expect(panel.kind).toBe('refused')
  })

  it('a refusal reaches the agent as a sentence, never as a wire code', () => {
    const codes = ['ITEM_NOT_FOUND', 'NO_CUSTOMER_ATTACHED', 'STORE_NOT_CHOSEN', 'SOMETHING_NEW_IN_1_11']
    for (const code of codes) {
      const panel = stockView({
        canPriceCheck: true,
        result: null,
        error: refusal(code),
        pending: false,
      })
      expect(panel.kind).toBe('refused')
      const sentence = i18n.t(
        (panel as Extract<StockPanel, { kind: 'refused' }>).refusal.key,
        (panel as Extract<StockPanel, { kind: 'refused' }>).refusal.params,
      )
      expect(sentence).not.toContain(code)
      expect(sentence.length).toBeGreaterThan(10)
    }
  })

  it('🚩 a network failure is a refusal too, and neither of them is *nobody has it*', () => {
    const panel = stockView({
      canPriceCheck: true,
      result: null,
      error: new ApiError('network', 'offline', 0),
      pending: false,
    })
    expect(panel.kind).toBe('refused')
    expect(panel.kind).not.toBe('none')
  })
})
