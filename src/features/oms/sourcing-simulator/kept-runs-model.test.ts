import { describe, expect, it } from 'vitest'
import type { AdvisePin, AdviseReply, KeptRun } from '@/core/models/sourcing-run'
import reply from './advise-reply.fixture.json'
import type { CartForm } from './cart'
import kept from './kept-runs.fixture.json'
import replay from './replay-reply.fixture.json'
import { canDelete, cartAsk, keepOffer, keepProblem, keptRunLink, keptRunsList, openedAsk, openedSetting, openedWeightSet, runToOpen } from './kept-runs-model'
import { runRequest } from './replan-model'

const RUNS = kept as KeptRun[]
const REPLY = reply as unknown as AdviseReply
const REPLAY = replay as unknown as AdviseReply

describe('the list of kept runs (ticket 969, spec 4354 §12)', () => {
  it("lists the caller's own kept runs, newest first: another keeper's run opens by its link only", () => {
    expect(keptRunsList(RUNS).map((r) => r.runId)).toEqual(['01JDQ7M4X9T2B6N8R3K5W1C0VA', '01JDP2Z8C4H6F1Q9Y7E3M5D2KB', '01JDM8T6B3W5N2X4Q9H7L1F0PD'])
  })

  it('lets only its keeper delete a kept run', () => {
    expect(canDelete(RUNS[0])).toBe(true)
    expect(canDelete(RUNS[1])).toBe(false)
  })
})

describe('what a kept run’s link opens', () => {
  it('is the simulator, opened on the run', () => {
    expect(keptRunLink('01JDQ7M4X9T2B6N8R3K5W1C0VA', 'https://oms.example')).toBe('https://oms.example/oms/sourcing-simulator?run=01JDQ7M4X9T2B6N8R3K5W1C0VA')
  })

  it('names the run the simulator opens, and none for an empty parameter', () => {
    expect(runToOpen('?run=01JDQ7M4X9T2B6N8R3K5W1C0VA')).toBe('01JDQ7M4X9T2B6N8R3K5W1C0VA')
    expect(runToOpen('?run=%2001JDQ7M4X9T2B6N8R3K5W1C0VA%20')).toBe('01JDQ7M4X9T2B6N8R3K5W1C0VA')
    expect(runToOpen('?run=')).toBeNull()
    expect(runToOpen('')).toBeNull()
  })

  it("sets the cart of a hand-built run back in the simulator, without the customer's point it never stored", () => {
    expect(openedSetting(REPLY)).toEqual({
      start: 'build',
      form: {
        channel: 'IOS',
        time: '19:42',
        goodsTotal: '',
        lines: [
          { key: 1, item: '100234', quantity: '2' },
          { key: 2, item: '100871', quantity: '1' },
          { key: 3, item: '104410', quantity: '1' },
        ],
        lat: '',
        lng: '',
      },
    })
  })

  it('sets the order of a replayed run back, from its own point', () => {
    expect(openedSetting({ ...REPLAY, kind: 'REPLAY_MOVED_POINT' })).toEqual({
      start: 'replay',
      replay: { orderNumber: '4500718264', withPoint: false, movedTo: null },
    })
  })
})

describe('keeping the run on screen', () => {
  it('offers to keep a held run, not one the door could not hold, nor one already stored', () => {
    expect(keepOffer(REPLY, false)).toBe('keep')
    expect(keepOffer({ ...REPLY, held: null }, false)).toBe('notHeld')
    expect(keepOffer({ ...REPLY, solve: { ...REPLY.solve, marks: ['NOT_HELD'] } }, false)).toBe('notHeld')
    expect(keepOffer(REPLY, true)).toBe('stored')
  })

  it('needs a name, of at most 80 characters', () => {
    expect(keepProblem('  ')).toBe('noName')
    expect(keepProblem('x'.repeat(81))).toBe('tooLong')
    expect(keepProblem(' Malqa replay ')).toBeNull()
  })
})

describe('a stored run opened by its link, as asked (review 2 #2 and #3)', () => {
  const pin: AdvisePin = { kind: 'LINE_STORE', lineNo: 3, store: '1090' }
  const storedCart = {
    channel: 'IOS',
    lines: [
      { lineNo: 1, item: '100234', quantity: 2, unit: 'EA' },
      { lineNo: 2, item: '100871', quantity: 1, unit: 'EA' },
      { lineNo: 3, item: '104410', quantity: 1, unit: 'EA' },
    ],
    customer: {},
    plannedFor: '2026-11-26 19:42:03',
    level: 'full',
    allPlans: true,
  }
  const setBack = (openedSetting(REPLY) as { start: 'build'; form: CartForm }).form

  it('holds a cart run as its stored cart, without the point it never kept, on the set it planned on', () => {
    expect(openedAsk(REPLY)).toEqual({ cart: storedCart, pins: [], weightSet: { name: 'Baseline', version: 1 } })
  })

  it('opens the weight set picker on the version the run planned on; a run on unsaved values, on their version', () => {
    expect(openedWeightSet(REPLY)).toEqual({ name: 'Baseline', version: 1 })
    const draft = { ...REPLY.weightSet, name: 'Express margin', version: 4, draft: true, basedOn: { name: 'Express margin', version: 4 } }
    expect(openedWeightSet({ ...REPLY, weightSet: draft })).toEqual({ name: 'Express margin', version: 4 })
  })

  it('while the form holds the cart as it was set back, the cart asked is the stored run’s own', () => {
    expect(cartAsk(setBack, REPLY)).toEqual({ cart: storedCart, fromStored: true })
  })

  it('so a changed pin plans again on the stored run’s figures', () => {
    const opened = openedAsk(REPLY)
    const { cart } = cartAsk(setBack, REPLY)
    expect(runRequest({ cart: cart!, pins: [pin], weightSet: opened.weightSet }, { ask: opened, runId: '01JDM3K8Q2V7X4T9B6N0R5W1YZ' })).toEqual({
      basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ',
      weightSet: { name: 'Baseline', version: 1 },
      pins: [pin],
      level: 'full',
      allPlans: true,
    })
  })

  it('a point typed, or any other change, asks the form’s own cart: a new run with its own read', () => {
    const now = new Date(2026, 10, 27, 9, 0)
    const placed = cartAsk({ ...setBack, lat: '24.7741', lng: '46.7386' }, REPLY, now)
    expect(placed.fromStored).toBe(false)
    expect(placed.cart).toMatchObject({ customer: { point: { lat: 24.7741, lng: 46.7386 } }, plannedFor: '2026-11-27 19:42:00' })
    expect(cartAsk({ ...setBack, channel: 'WEB' }, REPLY)).toEqual({ cart: null, fromStored: false })
  })

  it('with no stored run, or a replayed one, the form’s own cart', () => {
    expect(cartAsk(setBack, null)).toEqual({ cart: null, fromStored: false })
    expect(cartAsk(setBack, REPLAY)).toEqual({ cart: null, fromStored: false })
  })
})
