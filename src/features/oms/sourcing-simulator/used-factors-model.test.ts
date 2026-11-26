/**
 * Ticket 965 (BackOffice spec 4354 §12, story 35; 4281 decision 26, `used[]`): what the run used — every factor with how
 * it enters, whether it ran on real data, a neutral default or an assumption, or was switched off, and its source; four
 * counts on top — and the marks of the run ("straight line", "assumption", "no location", "list fee", "range not
 * confirmed", "figures as read at {time}"). Fed the door's worked example, its `used[]` widened to the model ticket's
 * factor list.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { runMarks, usedFactors } from './used-factors-model'

const reply = fixture as unknown as AdviseReply

describe('what the run used', () => {
  it('four counts: 8 factors on real data, 2 on a neutral default, 3 on an assumption, 2 switched off', () => {
    expect(usedFactors(reply).counts).toEqual({ REAL_DATA: 8, NEUTRAL_DEFAULT: 2, ASSUMED: 3, SWITCHED_OFF: 2 })
  })

  it('every factor, in the order sent, with how it enters, how it ran and its source', () => {
    const { rows } = usedFactors(reply)
    expect(rows).toHaveLength(15)
    expect(rows[0]).toEqual({ factor: 'STOCK_AFTER_OPEN_DEMAND', entersAs: 'OFFERED_STOCK', state: 'REAL_DATA', source: 'the stock read' })
    expect(rows.find((r) => r.factor === 'DELIVERIES_WAITING')).toEqual({ factor: 'DELIVERIES_WAITING', entersAs: 'PROMISE', state: 'REAL_DATA', source: 'live count, 38 seconds old' })
    expect(rows.find((r) => r.factor === 'RIDERS_AVAILABLE')).toEqual({ factor: 'RIDERS_AVAILABLE', entersAs: 'FILTER', state: 'SWITCHED_OFF', source: 'no data' })
  })

  it('a state the screen does not know is listed and counted under none of the four', () => {
    const odd = { ...reply, used: [{ factor: 'SHELF_LIFE', state: 'PARTLY', source: 'no data' }] }
    const used = usedFactors(odd)
    expect(used.counts).toEqual({ REAL_DATA: 0, NEUTRAL_DEFAULT: 0, ASSUMED: 0, SWITCHED_OFF: 0 })
    expect(used.rows).toEqual([{ factor: 'SHELF_LIFE', entersAs: null, state: 'PARTLY', source: 'no data' }])
  })

  it('a reply below the middle level used nothing it can say', () => {
    expect(usedFactors({ ...reply, used: undefined }).rows).toEqual([])
  })
})

describe('the marks of the run', () => {
  it('the door’s example: straight line, assumption, list fee and range not confirmed', () => {
    expect(runMarks(reply)).toEqual([{ key: 'straightLine' }, { key: 'assumption' }, { key: 'listFee' }, { key: 'rangeNotConfirmed' }])
  })

  it('a run planned again on the same figures says when they were read; a shipment with no km has no location; other marks follow', () => {
    const again: AdviseReply = {
      ...reply,
      basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ',
      figuresReadAt: '2026-11-26 19:42:03',
      solve: { ...reply.solve, marks: ['ROAD_NOT_MEASURED', 'STOCK_FEED_OLD'] },
      plans: reply.plans.map((p, i) => (i === 0 ? { ...p, shipments: [{ ...p.shipments[0], km: null, kmKind: null }] } : p)),
    }
    expect(runMarks(again)).toEqual([
      { key: 'straightLine' },
      { key: 'noLocation' },
      { key: 'listFee' },
      { key: 'figuresReadAt', at: '2026-11-26 19:42:03' },
      { key: 'solve', code: 'STOCK_FEED_OLD' },
    ])
  })

  it('a road-only run with no fee and no marks has none', () => {
    const plain: AdviseReply = {
      ...reply,
      solve: { ...reply.solve, marks: [] },
      plans: reply.plans.map((p) => ({ ...p, shipments: p.shipments.map((s) => ({ ...s, kmKind: 'ROAD', fee: 0, promiseParts: undefined })) })),
    }
    expect(runMarks(plain)).toEqual([])
  })
})
