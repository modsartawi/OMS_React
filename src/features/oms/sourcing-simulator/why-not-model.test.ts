/**
 * Ticket 965 (BackOffice spec 4354 story 28; BackOffice 4379, `search.whyNot[]` and `filterSteps`): "why not another
 * store" — pick a store and get, per mode, the rule that removed it, or the best plan that uses it and what it costs
 * more, part by part. The full-level reply the simulator already holds answers it (the server has no door of its own):
 * a pair steps 1 to 5 removed is in `filterSteps`, a later step's or a standing pair's in `search.whyNot`.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import split from './split-plan.fixture.json'
import { whyNotAnswer, whyNotStores } from './why-not-model'

const reply = fixture as unknown as AdviseReply
const plan = (goal: string) => reply.plans.find((p) => p.goal === goal) as AdvisePlan

describe('why not another store', () => {
  it('a store a filter step removed gives the step and its rule, read off the filter steps', () => {
    expect(whyNotAnswer(reply, '1203', plan('BALANCED'))).toEqual([{ mode: 'DAWAA_NOW', kind: 'removed', step: 5, code: 'OUT_OF_REACH' }])
  })

  it('a removal holds for every goal: the rule is the same whichever plan is open', () => {
    expect(whyNotAnswer(reply, '1203', plan('CHEAPEST'))).toEqual([{ mode: 'DAWAA_NOW', kind: 'removed', step: 5, code: 'OUT_OF_REACH' }])
  })

  it('a store still standing gives the best plan through it, its balanced total beside this plan’s, what it lost by and the extra cost by part; its removed pairs follow, in the modes’ order', () => {
    expect(whyNotAnswer(reply, '1061', plan('BALANCED'))).toEqual([
      {
        mode: 'DAWAA_NOW',
        kind: 'standing',
        sum: 43.1,
        planSum: 40.42,
        lostBy: 2.68,
        difference: [
          { part: 'COMPANY_COST', amount: 1.9 },
          { part: 'WAITING', amount: 0.78 },
        ],
      },
      { mode: 'CARRIER_SAME_DAY', kind: 'removed', step: 1, code: 'MODE_OFF' },
      { mode: 'PICK_UP', kind: 'removed', step: 11, code: 'NO_STOCK' },
    ])
  })

  it('a pair worked out for another goal is not this plan’s answer', () => {
    expect(whyNotAnswer(reply, '1061', plan('CHEAPEST'))!.map((l) => [l.mode, l.kind])).toEqual([
      ['CARRIER_SAME_DAY', 'removed'],
      ['PICK_UP', 'removed'],
    ])
  })

  it('a pair the search was given that has no plan of its own says why: it serves fewer lines, or the search did not reach it', () => {
    const lean: AdviseReply = { ...reply, search: { ...reply.search!, whyNot: [{ store: '1061', mode: 'DAWAA_NOW', goal: 'BALANCED', code: 'NOT_REACHED' }] } }
    expect(whyNotAnswer(lean, '1061', plan('BALANCED'))![0]).toEqual({ mode: 'DAWAA_NOW', kind: 'noPlan', code: 'NOT_REACHED' })
  })

  it('a store and mode the open plan already uses says so', () => {
    expect(whyNotAnswer(reply, '1061', split as unknown as AdvisePlan)![0]).toEqual({ mode: 'DAWAA_NOW', kind: 'inPlan' })
  })

  it('one line per mode, in the modes’ order, the plan’s own pair among them', () => {
    expect(whyNotAnswer(reply, '1090', plan('BALANCED'))!.map((l) => [l.mode, l.kind])).toEqual([
      ['DAWAA_NOW', 'inPlan'],
      ['SLOT', 'standing'],
      ['CARRIER_SAME_DAY', 'removed'],
      ['PICK_UP', 'standing'],
    ])
  })

  it('a reply below the full level carries no search, so there is no answer to give', () => {
    expect(whyNotAnswer({ ...reply, search: undefined }, '1061', plan('BALANCED'))).toBeNull()
  })
})

describe('the stores to pick from', () => {
  it('every store the run read, removed or used, once each, by code, with its name where the run has one', () => {
    expect(whyNotStores(reply)).toEqual([
      { store: '1055', name: 'Store 1055' },
      { store: '1061', name: 'Store 1061' },
      { store: '1090', name: 'Store 1090' },
      { store: '1203', name: 'Store 1203' },
    ])
  })

  it('a store known only from a removal has no name', () => {
    const lean = { ...reply, inputs: { stores: [] }, plans: [] }
    expect(whyNotStores(lean as AdviseReply)).toEqual([
      { store: '1055', name: null },
      { store: '1061', name: null },
      { store: '1090', name: null },
      { store: '1203', name: null },
    ])
  })
})
