/**
 * The sequence card's derivation (175's variant 4, second half).
 *
 * 🚩 Every case here is about the card **retiring**, or about the one row that
 * changes with the mode. Nothing asserts a rule about completeness — the whole
 * point of the module is that it holds none: the door's `submitBlockers` and
 * `canAddItem` are the only inputs, and a case that had to state what makes an
 * order addable would be the client-side predicate this module exists to avoid.
 */
import { describe, expect, it } from 'vitest'
import type {
  SessionCapabilities,
  SessionHeader,
  SessionStatus,
} from '@/core/models/callcenter'
import { openingSteps } from './opening-steps'

const header = (over: Partial<SessionHeader> = {}) => ({ ...over }) as SessionHeader
const caps = (over: Partial<SessionCapabilities> = {}) =>
  ({ canAddItem: false, submitBlockers: [], ...over }) as SessionCapabilities
const steps = (
  h: Partial<SessionHeader> = {},
  c: Partial<SessionCapabilities> = {},
  status: SessionStatus = 'open',
) => openingSteps(header(h), caps(c), status)

describe('theCardRetires', () => {
  it('🚩 draws nothing the moment the door will take an item', () => {
    // The gate, not a count of unfinished rows: an order the server accepts has
    // nothing left for this card to say, whatever else is still outstanding.
    expect(steps({}, { canAddItem: true, submitBlockers: ['NO_LINES', 'MISSING_SLOT'] })).toEqual([])
  })

  it('🚩 draws nothing on a pre-v1.6 server that never sends the gate', () => {
    // §9 — degrade to what the console can SEE. A card telling an agent to
    // attach a caller they already attached is worse than no card at all.
    const { canAddItem: _absent, ...rest } = caps()
    expect(openingSteps(header(), rest as SessionCapabilities, 'open')).toEqual([])
  })

  it('draws nothing once the order is no longer open', () => {
    // A placed order is not waiting for anything — and its `canAddItem` is false
    // for a reason that is not a sequence.
    expect(steps({}, {}, 'submitted')).toEqual([])
  })
})

describe('theStepsAreTheDoorsOwnList', () => {
  it('reads both outstanding steps off submitBlockers', () => {
    const rows = steps({}, { submitBlockers: ['NO_CUSTOMER', 'STORE_NOT_CHOSEN', 'NO_LINES'] })
    expect(rows.map((row) => [row.id, row.done])).toEqual([
      ['caller', false],
      ['where', false],
      ['items', false],
    ])
  })

  it('ticks the caller off as soon as the door stops naming it', () => {
    const rows = steps({}, { submitBlockers: ['STORE_NOT_CHOSEN'] })
    expect(rows[0].done).toBe(true)
    expect(rows[1].done).toBe(false)
  })

  it('🚩 leaves the last row undone even when the door names nothing', () => {
    // The gate is shut for a reason the console cannot see. The card still says
    // items are next rather than claiming they are already possible.
    const rows = steps({}, { submitBlockers: [] })
    expect(rows.map((row) => row.done)).toEqual([true, true, false])
  })

  it('survives a server that omits the blockers list entirely', () => {
    const { submitBlockers: _absent, ...rest } = caps()
    const rows = openingSteps(header(), rest as SessionCapabilities, 'open')
    expect(rows.map((row) => row.id)).toEqual(['caller', 'where', 'items'])
  })
})

describe('theSecondRowIsTheModes', () => {
  it('names the ADDRESS under delivery — the address is what chooses the store', () => {
    expect(steps({ deliveryType: 'Delivery' })[1].key).toBe('address')
  })

  it('names the STORE under collection, where the agent chooses it themselves', () => {
    expect(steps({ deliveryType: 'PickInStore' })[1].key).toBe('store')
  })

  it('🚩 does not consult NO_ADDRESS on a collection order', () => {
    // Such an order will never carry it, and a card waiting on a blocker that
    // cannot arrive is a step the agent can never tick off.
    expect(steps({ deliveryType: 'PickInStore' }, { submitBlockers: ['NO_ADDRESS'] })[1].done).toBe(
      true,
    )
  })

  it('holds the delivery row open until the address AND the store are settled', () => {
    expect(steps({ deliveryType: 'Delivery' }, { submitBlockers: ['NO_ADDRESS'] })[1].done).toBe(
      false,
    )
    expect(
      steps({ deliveryType: 'Delivery' }, { submitBlockers: ['STORE_NOT_CHOSEN'] })[1].done,
    ).toBe(false)
  })

  it('reads an absent deliveryType as delivery, like every other surface', () => {
    expect(steps()[1].key).toBe('address')
  })
})
