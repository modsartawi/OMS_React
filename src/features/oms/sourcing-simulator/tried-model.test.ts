/**
 * Ticket 966 (BackOffice spec 4354 §9, 4281 decision 27, the run record 4242 "search"): what was tried — the best whole
 * plans kept for a chosen goal, ten at first with "show more", what each lost by and the part that cost it most, and
 * the search counts — and the trade-off's points, every kept plan by time and money, shaped by its deliveries, the
 * shown plans marked. Fed the door's worked example with the rest of its kept plans put in.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { keptGoals, tradeOffPoints, triedFor } from './tried-model'

const reply = fixture as unknown as AdviseReply

describe('what was tried', () => {
  it('offers the goals the search kept plans for, in the screen’s goal order', () => {
    expect(keptGoals(reply)).toEqual(['BALANCED', 'CHEAPEST', 'PICK_UP'])
  })

  it('lists the ten best for the goal by rank, and says how many more there are', () => {
    const t = triedFor(reply, 'BALANCED', false)
    expect(t.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(t.more).toBe(2)
    expect(triedFor(reply, 'BALANCED', true).rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(triedFor(reply, 'BALANCED', true).more).toBe(0)
  })

  it('each row carries what it lost by against the winner and the part that cost it most, as sent', () => {
    const [winner, second] = triedFor(reply, 'BALANCED', false).rows
    expect(winner).toMatchObject({ rank: 1, winner: true, lostBy: 0, sum: 40.42, deliveries: 1 })
    expect(second).toEqual({
      rank: 2,
      winner: false,
      shipments: [{ store: '1055', mode: 'SLOT', lines: [1, 2, 3] }],
      deliveries: 1,
      pickUp: false,
      linesServed: 3,
      promiseBy: '2026-11-26 21:59:00',
      fee: 12.0,
      companyCost: 17.4,
      waiting: 9.8,
      sum: 41.87,
      lostBy: 1.45,
      lostMostOn: 'WAITING',
    })
  })

  it('another goal ranks its own kept plans', () => {
    const t = triedFor(reply, 'CHEAPEST', false)
    expect(t.rows.map((r) => [r.rank, r.lostBy, r.lostMostOn])).toEqual([
      [1, 0, null],
      [2, 0.3, 'COMPANY_COST'],
    ])
    expect(t.more).toBe(0)
  })

  it('reads the search counts as sent', () => {
    expect(triedFor(reply, 'BALANCED', false).counts).toEqual({ plansChecked: 1846, cutByShipmentCap: 212, cutByMixing: 96, cutByPins: 0 })
  })

  it('a reply below the full level has nothing tried', () => {
    const plain = { ...reply, search: undefined }
    expect(keptGoals(plain)).toEqual([])
    expect(triedFor(plain, 'BALANCED', false)).toEqual({ rows: [], more: 0, counts: null })
  })
})

describe('the trade-off', () => {
  const points = tradeOffPoints(reply)

  it('draws each kept plan once, even when two goals kept it', () => {
    // 12 BALANCED + 2 CHEAPEST + 1 PICK_UP kept, of which 1055 SLOT, 1090 SLOT and 1090 PICK_UP are kept twice.
    expect(points).toHaveLength(12)
  })

  it('puts a plan at the minutes until its last shipment arrives and its fee with the company’s cost', () => {
    const p = points.find((x) => x.key === '1061:DAWAA_NOW:1,2,3')!
    expect(p).toMatchObject({ minutes: 59, fee: 16.0, companyCost: 19.32, money: 35.32, deliveries: 1, shape: 'circle', shown: [] })
  })

  it('shapes a point by its deliveries, pick-up apart', () => {
    const shape = (id: string) => points.find((x) => x.key === id)!.shape
    expect(shape('1090:PICK_UP:1,2,3')).toBe('diamond')
    expect(shape('1090:DAWAA_NOW:1,2|1055:SLOT:3')).toBe('square')
    expect(shape('1061:DAWAA_NOW:1|1055:SLOT:2|1090:DAWAA_NOW:3')).toBe('triangle')
  })

  it('marks the plans shown, with every goal each answers', () => {
    const shown = points.filter((x) => x.shown.length).map((x) => [x.key, x.shown])
    expect(shown).toEqual([
      ['1090:DAWAA_NOW:1,2,3', ['BALANCED', 'FASTEST', 'FEWEST']],
      ['1090:PICK_UP:1,2,3', ['PICK_UP']],
      ['1055:SLOT:1,2,3', ['CHEAPEST']],
    ])
  })

  it('a kept plan whose promise time does not read is left off the chart', () => {
    const [kept] = reply.search!.kept
    const bare = { ...reply, search: { ...reply.search!, kept: [{ ...kept, by: '' }] } }
    expect(tradeOffPoints(bare)).toEqual([])
  })
})
