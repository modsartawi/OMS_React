/**
 * Ticket 965 (BackOffice spec 4354 §12, story 35; BackOffice 4379, `RecordUsed`): what the run used — every factor, per
 * mode where it is read per mode, whether it ran on real data, a neutral default or an assumption, or was switched off,
 * its source and how many stores ran on the default; four counts on top — and the marks of the run ("straight line",
 * "assumption", "no location", "list fee", "range not confirmed", "figures as read at {time}"). Fed a reply in the
 * server's shape.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { runMarks, usedFactors } from './used-factors-model'

const reply = fixture as unknown as AdviseReply

describe('what the run used', () => {
  it('four counts: 9 factors on real data, 2 on a neutral default, 3 on an assumption, 2 switched off', () => {
    expect(usedFactors(reply).counts).toEqual({ REAL_DATA: 9, NEUTRAL_DEFAULT: 2, ASSUMPTION: 3, SWITCHED_OFF: 2 })
  })

  it('every factor, in the order sent, with its mode, how it ran, its source and the stores on the default', () => {
    const { rows } = usedFactors(reply)
    expect(rows).toHaveLength(16)
    expect(rows[0]).toEqual({ factor: 'STOCK', mode: null, state: 'REAL_DATA', source: null, storesOnDefault: null })
    expect(rows.find((r) => r.factor === 'MADE_READY')).toEqual({ factor: 'MADE_READY', mode: null, state: 'REAL_DATA', source: 'STORES_OWN', storesOnDefault: 1 })
    expect(rows.filter((r) => r.factor === 'DELIVERY_RATE')).toEqual([
      { factor: 'DELIVERY_RATE', mode: 'SLOT', state: 'ASSUMPTION', source: 'ASSUMED', storesOnDefault: null },
      { factor: 'DELIVERY_RATE', mode: 'DAWAA_NOW', state: 'REAL_DATA', source: 'MEASURED', storesOnDefault: null },
    ])
  })

  it('a state the screen does not know is listed and counted under none of the four', () => {
    const odd = { ...reply, used: [{ factor: 'WEIGHT_LIMIT', state: 'PARTLY' }] }
    const used = usedFactors(odd)
    expect(used.counts).toEqual({ REAL_DATA: 0, NEUTRAL_DEFAULT: 0, ASSUMPTION: 0, SWITCHED_OFF: 0 })
    expect(used.rows).toEqual([{ factor: 'WEIGHT_LIMIT', mode: null, state: 'PARTLY', source: null, storesOnDefault: null }])
  })

  it('a reply below the middle level used nothing it can say', () => {
    expect(usedFactors({ ...reply, used: undefined }).rows).toEqual([])
  })
})

describe('the marks of the run', () => {
  it('straight line, assumption, list fee and range not confirmed (a plan’s mark, BackOffice 4362)', () => {
    expect(runMarks(reply)).toEqual([{ key: 'straightLine' }, { key: 'assumption' }, { key: 'listFee' }, { key: 'rangeNotConfirmed' }])
  })

  it('a run planned again on the same figures says when they were read; a shipment with no km has no location; other marks follow', () => {
    const again: AdviseReply = {
      ...reply,
      basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ',
      figuresReadAt: '2026-11-26 19:42:03',
      solve: { ...reply.solve, marks: ['ROAD_NOT_MEASURED', 'STOCK_FEED_OLD'] },
      plans: reply.plans.map((p) => ({ ...p, marks: undefined, shipments: p.shipments.map((s, i) => (i === 0 && p.goal === 'BALANCED' ? { ...s, km: undefined, kmKind: '' } : s)) })),
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
      plans: reply.plans.map((p) => ({ ...p, marks: undefined, shipments: p.shipments.map((s) => ({ ...s, kmKind: 'ROAD', fee: 0, promiseParts: undefined })) })),
    }
    expect(runMarks(plain)).toEqual([])
  })
})
