/**
 * Ticket 963 (BackOffice spec 4354 §3; 4281 decisions 15 and 24; BackOffice 4359): the pins as chips, a refused pin kept
 * on its chip with its reason, a clash that leaves no plan, and what the pins cost each plan — read off the run without
 * pins the reply carries. Fed the door's worked example (4281) with its refused pin and a run without pins beside it.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePin, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import pinsFixture from './pins-reply.fixture.json'
import { addPin, pinChips, pinsClash, pinsCost, removePin, storesSeen } from './pins-model'

const reply = fixture as unknown as AdviseReply
const sent = pinsFixture.pins as AdvisePin[]
const pinned: AdviseReply = { ...reply, refusedPins: pinsFixture.refusedPins as AdviseReply['refusedPins'], withoutPins: pinsFixture.withoutPins as AdviseReply['withoutPins'] }

describe('the pins as chips', () => {
  it('a pin that held has no reason; a refused pin stays listed with its code, filter step and rule', () => {
    expect(pinChips(sent, pinned)).toEqual([
      { key: 'LINE_STORE:3:1090', pin: { kind: 'LINE_STORE', lineNo: 3, store: '1090' }, refusal: null },
      {
        key: 'LINE_MODE:2:DAWAA_NOW',
        pin: { kind: 'LINE_MODE', lineNo: 2, mode: 'DAWAA_NOW' },
        refusal: { code: 'PIN_PAIR_REMOVED', step: 10, stepCode: 'PRODUCT_RULE', rule: 'cold items: slot delivery and pick-up only' },
      },
    ])
  })

  it('before any run the chips carry no reason', () => {
    expect(pinChips(sent, null).map((c) => c.refusal)).toEqual([null, null])
  })

  it('a pin on a field order the server echoes differently still finds its refusal', () => {
    const echoed: AdviseReply = { ...pinned, refusedPins: [{ ...pinned.refusedPins[0], pin: { mode: 'DAWAA_NOW', lineNo: 2, kind: 'LINE_MODE' } as AdvisePin }] }
    expect(pinChips(sent, echoed)[1].refusal?.code).toBe('PIN_PAIR_REMOVED')
  })

  it('pins that clash together each carry the clash and the rule they break', () => {
    const one: AdvisePin = { kind: 'ONE_SHIPMENT' }
    const notMode: AdvisePin = { kind: 'NOT_MODE', mode: 'DAWAA_NOW' }
    const clash: AdviseReply = { ...reply, refusedPins: [{ pins: [one, notMode], code: 'PINS_CLASH', rule: 'no single store holds the whole cart by another mode' }] }
    expect(pinChips([one, notMode], clash).map((c) => c.refusal?.code)).toEqual(['PINS_CLASH', 'PINS_CLASH'])
    expect(pinChips([one, notMode], clash)[0].refusal?.rule).toBe('no single store holds the whole cart by another mode')
  })
})

describe('adding and removing a pin', () => {
  it('a line pinned to a second store replaces its first store; the same pin twice is one pin', () => {
    const a = addPin([], { kind: 'LINE_STORE', lineNo: 3, store: '1090' })
    const b = addPin(a, { kind: 'LINE_STORE', lineNo: 3, store: '1055' })
    expect(b).toEqual([{ kind: 'LINE_STORE', lineNo: 3, store: '1055' }])
    expect(addPin(b, { kind: 'LINE_STORE', lineNo: 3, store: '1055' })).toEqual(b)
  })

  it('a line keeps a store pin and a mode pin side by side; "never" pins add up', () => {
    const pins = [
      { kind: 'LINE_STORE', lineNo: 3, store: '1090' },
      { kind: 'LINE_MODE', lineNo: 3, mode: 'SLOT' },
      { kind: 'NOT_STORE', store: '1055' },
      { kind: 'NOT_STORE', store: '1061' },
    ] as AdvisePin[]
    expect(pins.reduce<AdvisePin[]>(addPin, [])).toEqual(pins)
    expect(removePin(pins, { kind: 'NOT_STORE', store: '1055' })).toEqual([pins[0], pins[1], pins[3]])
  })
})

describe('what the pins cost each plan', () => {
  it('in minutes, riyals and deliveries, against the same goal of the run without pins', () => {
    const cost = pinsCost(pinned)
    // Recommended: by 20:35 pinned against 20:20 without; company's cost 17.420 against 15.100.
    expect(cost.BALANCED).toEqual({ kind: 'cost', minutes: 15, fee: 0, companyCost: 2.32, deliveries: 0 })
    // Cheapest is the same plan either way.
    expect(cost.CHEAPEST).toEqual({ kind: 'nothing' })
    expect(cost.PICK_UP).toEqual({ kind: 'cost', minutes: 5, fee: 0, companyCost: 0.26, deliveries: 0 })
  })

  it('a goal the run without pins had no plan for says so; a run sent without pins has no cost at all', () => {
    const without = { ...pinned.withoutPins!, plans: pinned.withoutPins!.plans.filter((p) => p.goal !== 'PICK_UP') }
    expect(pinsCost({ ...pinned, withoutPins: without }).PICK_UP).toEqual({ kind: 'noPlanWithout' })
    expect(pinsCost(reply)).toEqual({})
  })
})

describe('pins that leave no plan', () => {
  it('one banner naming the pins that clash and the rule they break', () => {
    const one: AdvisePin = { kind: 'ONE_SHIPMENT' }
    const notMode: AdvisePin = { kind: 'NOT_MODE', mode: 'PICK_UP' }
    const none: AdviseReply = {
      ...reply,
      plans: [],
      noPlan: (['BALANCED', 'FASTEST', 'FEWEST', 'CHEAPEST', 'PICK_UP'] as const).map((goal) => ({ goal, code: 'PINS_CLASH', en: 'These pins leave no plan', ar: 'هذه التثبيتات لا تترك خطة' })),
      refusedPins: [{ pins: [one, notMode], code: 'PINS_CLASH', rule: 'no single store holds the whole cart' }],
    }
    expect(pinsClash(none, [one, notMode])).toEqual({ pins: [one, notMode], rules: ['no single store holds the whole cart'] })
  })

  it('a clash with no list of its own names every pin sent that was not refused alone', () => {
    const one: AdvisePin = { kind: 'ONE_SHIPMENT' }
    const none: AdviseReply = {
      ...pinned,
      plans: [],
      noPlan: [{ goal: 'BALANCED', code: 'PINS_CLASH', en: '', ar: '' }],
    }
    expect(pinsClash(none, [...sent, one])).toEqual({ pins: [sent[0], one], rules: [] })
  })

  it('a clash on some goals while another goal has a plan raises no banner', () => {
    const some: AdviseReply = { ...reply, noPlan: [{ goal: 'PICK_UP', code: 'PINS_CLASH', en: '', ar: '' }] }
    expect(pinsClash(some, sent)).toBeNull()
  })
})

describe('the stores "never this store" offers', () => {
  it('every store the run showed — on its plans, the run without pins and the stores it read — once, in code order', () => {
    expect(storesSeen(pinned)).toEqual(['1055', '1061', '1090'])
    expect(storesSeen(null)).toEqual([])
  })
})
