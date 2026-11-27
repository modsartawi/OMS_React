/**
 * Ticket 964 (BackOffice spec 4354 §16, SIMT decision 7, CMP 93): on a replay, "What happened" stands beside the plans —
 * the store and mode routing chose, when it was delivered, late or not, the fee — with one sentence against the
 * Recommended plan. A replay whose customer's point was moved by hand drops it. Fed the replay reply in the server's
 * shape (BackOffice 4381's `whatHappened[]`, `replay-reply.fixture.json`, the drive's too); expected values are read off
 * the fixture by hand.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './replay-reply.fixture.json'
import { happenedCells, whatHappened } from './what-happened-model'

const REPLAY = fixture as unknown as AdviseReply
const reply = (over: Partial<AdviseReply> = {}): AdviseReply => ({ ...REPLAY, ...over })
const WH = REPLAY.whatHappened!

describe('the card’s facts, from a replay reply', () => {
  it('the order, and each real delivery: its store and mode, when it came in and was delivered, late or not, its fee', () => {
    const card = whatHappened(reply())
    expect(card?.orderNumber).toBe('4500718264')
    expect(card?.deliveries).toEqual([
      { delivery: '8100553201', store: '1055', storeName: 'Store 1055', mode: 'SLOT', cameInAt: '2026-11-26 19:42:00', deliveredAt: '2026-11-26 22:40:00', late: true, fee: 12 },
    ])
  })

  it('one delivery, a fee of 12.000 paid; delivered at its last delivery; late when any delivery was', () => {
    const card = whatHappened(reply())
    expect(card).toMatchObject({ count: 1, fee: 12, deliveredAt: '2026-11-26 22:40:00', late: true })
  })

  it('a delivery not yet delivered leaves the order undelivered and not late', () => {
    const card = whatHappened(reply({ whatHappened: [{ ...WH[0], deliveredAt: undefined, late: undefined }] }))
    expect(card).toMatchObject({ deliveredAt: null, late: false })
  })

  it('a store the reply gives no name for is named by its code alone, and a delivery no mode reads has none', () => {
    const card = whatHappened(reply({ whatHappened: [{ ...WH[0], store: '1777', mode: undefined }] }))
    expect(card?.deliveries[0]).toMatchObject({ store: '1777', storeName: '', mode: null })
  })

  it('the fee paid is the deliveries’ fees, each a fact; the count is how many deliveries came', () => {
    const card = whatHappened(reply({ whatHappened: [WH[0], { ...WH[0], deliveryNo: '8100553202', fee: 4.5, cameInAt: '2026-11-26 19:45:00' }] }))
    expect(card).toMatchObject({ count: 2, fee: 16.5 })
  })
})

describe('the one sentence against the Recommended plan', () => {
  it('Recommended promises everything 53 minutes after planning; the order took 2 h 58 min from its first delivery coming in to its last delivered: 125 minutes sooner', () => {
    expect(whatHappened(reply())?.against).toEqual({
      kind: 'sooner',
      planMinutes: 53,
      happenedMinutes: 178,
      apartMinutes: 125,
      planDeliveries: 1,
      deliveries: 1,
      planFee: 16,
      fee: 12,
    })
  })

  it('a promise later than the order took reads "later"', () => {
    const rec = { ...REPLAY.plans[0], promise: { ...REPLAY.plans[0].promise, by: '2026-11-27 23:00:00' } }
    expect(whatHappened(reply({ plans: [rec] }))?.against).toMatchObject({ kind: 'later', planMinutes: 198, happenedMinutes: 178, apartMinutes: 20 })
  })

  it('the same time reads "same"', () => {
    const rec = { ...REPLAY.plans[0], promise: { ...REPLAY.plans[0].promise, by: '2026-11-27 22:40:03' } }
    expect(whatHappened(reply({ plans: [rec] }))?.against).toMatchObject({ kind: 'same', apartMinutes: 0 })
  })

  it('an order with no delivery yet is not set against the plan’s time', () => {
    const against = whatHappened(reply({ whatHappened: [{ ...WH[0], deliveredAt: undefined, late: undefined }] }))?.against
    expect(against).toEqual({ kind: 'notDelivered', planMinutes: 53, planDeliveries: 1, deliveries: 1, planFee: 16, fee: 12 })
  })

  it('no Recommended plan: the card stands without a sentence', () => {
    expect(whatHappened(reply({ plans: REPLAY.plans.filter((p) => p.goal !== 'BALANCED') }))?.against).toBeNull()
  })
})

describe('when there is no card', () => {
  it('a replay whose customer’s point was moved by hand drops it', () => {
    expect(whatHappened(reply({ kind: 'REPLAY_MOVED_POINT' }))).toBeNull()
  })

  it('a hand-built cart has none', () => {
    expect(whatHappened(reply({ kind: 'HAND_BUILT', whatHappened: undefined }))).toBeNull()
  })

  it('a replay whose reply carries no "what happened" has none', () => {
    expect(whatHappened(reply({ whatHappened: undefined }))).toBeNull()
  })
})

describe('the table’s last column', () => {
  it('a cell per measure: delivered and late, deliveries, the store and mode, the fee with its parts; the company’s cost not recorded', () => {
    const cells = happenedCells(whatHappened(reply())!)
    expect(cells).toEqual({
      promise: { kind: 'delivered', at: '2026-11-26 22:40:00', late: true },
      deliveries: { kind: 'count', value: 1 },
      storesAndModes: { kind: 'shipments', shipments: [{ no: 1, store: '1055', storeName: 'Store 1055', mode: 'SLOT' }] },
      fee: { kind: 'money', value: 12, perShipment: [12] },
      companyCost: { kind: 'notRecorded' },
      waiting: { kind: 'notRecorded' },
      balanced: { kind: 'notRecorded' },
    })
  })
})
