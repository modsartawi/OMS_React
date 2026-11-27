/**
 * Ticket 964 (BackOffice spec 4354 §16, SIMT decision 7, CMP 93): on a replay, "What happened" stands beside the plans —
 * the store and mode routing chose, when it was delivered, late or not, the fee — with one sentence against the
 * Recommended plan. A replay whose customer's point was moved by hand drops it. Fed the replay stub
 * (`replay-reply.fixture.json`, the drive's too); expected values are read off the fixture by hand.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './replay-reply.fixture.json'
import { happenedCells, whatHappened } from './what-happened-model'

const REPLAY = fixture as unknown as AdviseReply
const reply = (over: Partial<AdviseReply> = {}): AdviseReply => ({ ...REPLAY, ...over })

describe('the card’s facts, from a replay reply', () => {
  it('the order, and each real delivery: its store and mode, when it was delivered, late or not, its fee', () => {
    const card = whatHappened(reply())
    expect(card?.orderNumber).toBe('4500718264')
    expect(card?.deliveries).toEqual([
      { delivery: '8100553201', store: '1055', storeName: 'Store 1055', mode: 'SLOT', deliveredAt: '2026-11-26 22:40:00', late: true, minutesLate: 40, fee: 12 },
    ])
  })

  it('the totals as sent: one delivery, a fee of 12.000; delivered at its last delivery; late when any delivery was', () => {
    const card = whatHappened(reply())
    expect(card).toMatchObject({ count: 1, fee: 12, deliveredAt: '2026-11-26 22:40:00', late: true })
  })

  it('a delivery not yet delivered leaves the order undelivered and not late', () => {
    const wh = REPLAY.whatHappened!
    const card = whatHappened(reply({ whatHappened: { ...wh, deliveries: [{ ...wh.deliveries[0], deliveredAt: null, late: null, minutesLate: null }] } }))
    expect(card).toMatchObject({ deliveredAt: null, late: false })
  })
})

describe('the one sentence against the Recommended plan', () => {
  it('Recommended promises everything 53 minutes after planning; the order took 2 h 58 min to its last delivery: 125 minutes sooner', () => {
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
    const wh = REPLAY.whatHappened!
    const against = whatHappened(reply({ whatHappened: { ...wh, deliveries: [{ ...wh.deliveries[0], deliveredAt: null, late: null, minutesLate: null }] } }))?.against
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
    expect(whatHappened(reply({ whatHappened: null }))).toBeNull()
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
