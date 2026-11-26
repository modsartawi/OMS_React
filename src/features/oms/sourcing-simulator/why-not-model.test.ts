/**
 * Ticket 965 (BackOffice spec 4354 story 28; 4281 decision 27, `search.whyNot[]`): "why not another store" — pick a
 * store and get, per mode, the rule that removed it, or the best plan that uses it and what it costs more, part by
 * part. The rows are 4281's worked example; the call that answers them is stubbed with the same rows.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePlan, AdviseReply, AdviseWhyNot } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import split from './split-plan.fixture.json'
import { whyNotAnswer, whyNotStores } from './why-not-model'

const reply = fixture as unknown as AdviseReply
const plan = (goal: string) => reply.plans.find((p) => p.goal === goal) as AdvisePlan
const rows = reply.search?.whyNot as AdviseWhyNot[]

describe('why not another store', () => {
  it('a store a filter step removed gives the step and its rule', () => {
    expect(whyNotAnswer(rows, '1203', plan('BALANCED'))).toEqual([{ mode: 'DAWAA_NOW', kind: 'removed', step: 5, code: 'OUT_OF_REACH' }])
  })

  it('a removal holds for every goal: the rule is the same whichever plan is open', () => {
    expect(whyNotAnswer(rows, '1203', plan('CHEAPEST'))).toEqual([{ mode: 'DAWAA_NOW', kind: 'removed', step: 5, code: 'OUT_OF_REACH' }])
  })

  it('a store still standing gives the best plan through it, its balanced total beside this plan’s, and the extra cost by part', () => {
    expect(whyNotAnswer(rows, '1061', plan('BALANCED'))).toEqual([
      {
        mode: 'DAWAA_NOW',
        kind: 'standing',
        sum: 43.1,
        planSum: 40.42,
        difference: [
          { part: 'STORE_RECORD', amount: 1.9 },
          { part: 'WAITING', amount: 0.78 },
        ],
      },
    ])
  })

  it('a pair worked out for another goal is not this plan’s answer', () => {
    expect(whyNotAnswer(rows, '1061', plan('CHEAPEST'))).toEqual([])
  })

  it('a store and mode the open plan already uses says so', () => {
    expect(whyNotAnswer(rows, '1061', split as unknown as AdvisePlan)).toEqual([{ mode: 'DAWAA_NOW', kind: 'inPlan' }])
  })

  it('one line per mode, in the modes’ order, the plan’s own pair among them', () => {
    // Store 1090's own rows in the fixture (966's "why not" rows) are set aside: this case states its own.
    const more: AdviseWhyNot[] = [
      ...rows.filter((r) => r.store !== '1090'),
      { store: '1090', mode: 'PICK_UP', removedAt: 11, code: 'NO_STOCK' },
      { store: '1090', mode: 'SLOT', goal: 'BALANCED', sum: 45.0, difference: [{ part: 'WAITING', amount: 4.58 }] },
    ]
    expect(whyNotAnswer(more, '1090', plan('BALANCED')).map((l) => [l.mode, l.kind])).toEqual([
      ['DAWAA_NOW', 'inPlan'],
      ['SLOT', 'standing'],
      ['PICK_UP', 'removed'],
    ])
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
