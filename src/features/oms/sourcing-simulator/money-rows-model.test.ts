/**
 * Ticket 965 (BackOffice spec 4354 §6; 4281 decision 26, `costParts` and `plans[].sum`; BackOffice 4363, 4386): the
 * money of a plan — a row per part, a column per shipment, every figure with its source as sent, the plan's own figures
 * in its column, and a banner naming the assumed ones — and how deliveries go at each shipment's store, a row per
 * measure against like stores. Fed the door's worked example (CHEAPEST's cost parts are 4281's own) and a split plan.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import split from './split-plan.fixture.json'
import { moneyRows, storeRecords } from './money-rows-model'

const reply = fixture as unknown as AdviseReply
const plan = (goal: string) => reply.plans.find((p) => p.goal === goal) as AdvisePlan
const splitPlan = split as unknown as AdvisePlan

describe('the money of a split plan', () => {
  const money = moneyRows(splitPlan)
  const row = (key: string) => money.rows.find((r) => r.key === key)

  it('has a column per shipment', () => {
    expect(money.columns).toEqual([
      { no: 1, store: '1090' },
      { no: 2, store: '1061' },
    ])
  })

  it('has the fee, each cost part sent, the company’s cost, then the plan’s own parts of the balanced sum', () => {
    expect(money.rows.map((r) => r.key)).toEqual(['fee', 'DELIVERY_RATE', 'HANDLING', 'STORE_RECORD', 'companyCost', 'waiting', 'cover', 'split', 'balanced'])
  })

  it('every shipment’s figure carries its source', () => {
    expect(row('fee')?.cells).toEqual([
      { amount: 16, source: 'ASSUMED' },
      { amount: 16, source: 'ASSUMED' },
    ])
    expect(row('DELIVERY_RATE')?.cells).toEqual([
      { amount: 15, source: 'MEASURED' },
      { amount: 15, source: 'MEASURED' },
    ])
    expect(row('STORE_RECORD')?.cells).toEqual([
      { amount: 0.42, source: 'STEADIED' },
      { amount: 0.3, source: 'STEADIED' },
    ])
  })

  it('the plan column holds only the totals the server sent: no part is added up across shipments', () => {
    expect(row('fee')?.plan).toEqual({ amount: 32, source: null })
    expect(row('companyCost')?.plan).toEqual({ amount: 34.72, source: null })
    expect(row('companyCost')?.cells.map((c) => c?.amount)).toEqual([17.42, 17.3])
    expect(row('DELIVERY_RATE')?.plan).toBeNull()
    expect(row('HANDLING')?.plan).toBeNull()
  })

  it('the price of waiting, the cover cost, the split penalty and the balanced total are the plan’s alone', () => {
    expect(row('waiting')).toEqual({ key: 'waiting', kind: 'plan', cells: [null, null], plan: { amount: 6.5, source: null } })
    expect(row('balanced')?.plan).toEqual({ amount: 73.22, source: null })
  })

  it('the banner names the customer’s fee and handling as assumed', () => {
    expect(money.assumed).toEqual(['fee', 'HANDLING'])
  })
})

describe('the money of one shipment', () => {
  it('the door’s slot shipment: four cost parts as sent, and the fee, delivery rate and handling assumed', () => {
    const money = moneyRows(plan('CHEAPEST'))
    expect(money.rows.filter((r) => r.kind === 'part').map((r) => [r.key, r.cells[0]])).toEqual([
      ['DELIVERY_RATE', { amount: 14.35, source: 'ASSUMED' }],
      ['HANDLING', { amount: 2, source: 'ASSUMED' }],
      ['STORE_RECORD', { amount: -0.175, source: 'STEADIED' }],
      ['NO_STOCK', { amount: 6.775, source: 'WEIGHT_SET' }],
    ])
    expect(money.assumed).toEqual(['fee', 'DELIVERY_RATE', 'HANDLING'])
  })

  it('pick-up has no delivery rate, so no row for it', () => {
    expect(moneyRows(plan('PICK_UP')).rows.map((r) => r.key)).not.toContain('DELIVERY_RATE')
  })

  it('a part the screen does not know yet still gets its row, after the known ones', () => {
    const p = plan('PICK_UP')
    const odd = { ...p, shipments: [{ ...p.shipments[0], costParts: [{ part: 'CARRIER_SURCHARGE', amount: 1.5, source: 'FINANCE' }, ...(p.shipments[0].costParts ?? [])] }] }
    expect(moneyRows(odd).rows.filter((r) => r.kind === 'part').map((r) => r.key)).toEqual(['HANDLING', 'STORE_RECORD', 'CARRIER_SURCHARGE'])
  })

  it('a plan with no sum (the plans-only level) has no plan rows and no cost parts', () => {
    const p = plan('BALANCED')
    const bare = { ...p, sum: undefined, shipments: p.shipments.map(({ costParts: _, ...s }) => s) }
    expect(moneyRows(bare).rows.map((r) => r.key)).toEqual(['fee', 'companyCost'])
  })
})

describe('how deliveries go at this store', () => {
  it('a row per measure against like stores, with the deliveries behind it and its cost or credit', () => {
    const [rec] = storeRecords(plan('CHEAPEST'), reply)
    expect(rec).toMatchObject({ no: 1, store: '1055', mode: 'SLOT', read: true, cost: -0.175 })
    expect(rec.rows).toEqual([
      { measure: 'late', rate: 0.031, likeStores: 0.038, count: 412, source: 'STEADIED', cost: -0.07, neutral: false },
      { measure: 'returned', rate: 0.012, likeStores: 0.0162, count: 412, source: 'STEADIED', cost: -0.105, neutral: false },
      { measure: 'cancelled', rate: 0.009, likeStores: 0.009, count: 0, source: 'NEUTRAL_DEFAULT', cost: 0, neutral: true },
    ])
  })

  it('each shipment of a split plan reads its own store’s record for its own mode', () => {
    const recs = storeRecords(splitPlan, reply)
    expect(recs.map((r) => [r.store, r.mode, r.rows.map((m) => m.measure).join(), r.cost])).toEqual([
      ['1090', 'DAWAA_NOW', 'calloutIgnored', 0.42],
      ['1061', 'DAWAA_NOW', 'calloutIgnored', 0.3],
    ])
  })

  it('a store the run did not read has no rows, and says so', () => {
    const p = plan('CHEAPEST')
    const elsewhere = { ...p, shipments: [{ ...p.shipments[0], store: '9999' }] }
    const [rec] = storeRecords(elsewhere, reply)
    expect(rec.read).toBe(false)
    expect(rec.rows).toEqual([])
  })
})
