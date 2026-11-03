import { describe, expect, it } from 'vitest'
import type { SourcingCandidate, SourcingExplainReply } from '@/core/models/sourcing-advisor'
import { explainModel } from './explain-model'

const candidate = (store: string, over: Partial<SourcingCandidate> = {}): SourcingCandidate => ({
  store,
  storeName: `Store ${store}`,
  km: 2.1,
  cost: 15.5,
  costParts: { courier: 12, pick: 3.5, split: 0, express: 0 },
  onTime: true,
  stockEvidence: 'recorded',
  ...over,
})

const reply = (over: Partial<SourcingExplainReply> = {}): SourcingExplainReply => ({
  orderNo: '8000000253',
  deliveryType: 'D',
  city: 'Riyadh',
  promisedBy: '2026-11-02T18:00:00',
  actual: { store: 'P007', storeName: 'Malaz', km: 7.43, cost: 24.5, onTime: true, readyMins: 18, travelMins: 22 },
  best: { store: 'P002', storeName: 'Rawdah', km: 2.1, cost: 15.5, onTime: true, readyMins: 12, travelMins: 7 },
  candidates: [candidate('P002'), candidate('P007', { storeName: 'Malaz', km: 7.43, cost: 24.5, costParts: { courier: 21, pick: 3.5, split: 0, express: 0 } })],
  saving: 9,
  reasons: ['NEARER_STORE_STOCKED'],
  rateVersion: 'placeholder-2026-11',
  placeholderRates: true,
  ...over,
})

describe('sourcingExplainModel_buildsActualBestAndCandidates', () => {
  it('reads the order, the actual store and the cheapest on-time one as code · name pairs', () => {
    const m = explainModel(reply())
    expect(m.order).toEqual({ orderNo: '8000000253', deliveryType: 'D', city: 'Riyadh', promisedBy: '2026-11-02T18:00:00' })
    expect(m.actual).toEqual({ store: 'P007 · Malaz', km: '7.4', cost: '24.50', readyMins: '18', travelMins: '22', onTime: 'yes' })
    expect(m.best).toEqual({ store: 'P002 · Rawdah', km: '2.1', cost: '15.50', readyMins: '12', travelMins: '7', onTime: 'yes' })
    expect(m.placeholderRates).toBe(true)
    expect(m.rateVersion).toBe('placeholder-2026-11')
  })

  it('shows the saving in SAR when the best candidate is on time', () => {
    expect(explainModel(reply()).saving).toEqual({ shown: true, amount: '9.00' })
  })

  it('cost parts sum to each candidate cost as shown, to the halala', () => {
    const m = explainModel(
      reply({
        candidates: [
          // Parts that round apart from the sent cost: 3.33 + 1.33 + 0.00 + 5.33 = 9.99 on screen.
          candidate('P010', { cost: 10, costParts: { courier: 3.334, pick: 1.333, split: 0, express: 5.333 } }),
          // A split penalty and no express part sent at all.
          candidate('P011', { cost: 20.75, costParts: { courier: 14.25, pick: 3.5, split: 3 } }),
        ],
      }),
    )
    expect(m.candidates.map((c) => [c.courier, c.pick, c.split, c.express, c.cost])).toEqual([
      ['3.33', '1.33', '0.00', '5.33', '9.99'],
      ['14.25', '3.50', '3.00', null, '20.75'],
    ])
  })

  it('a candidate with no cost parts shows the sent cost and no parts', () => {
    const m = explainModel(reply({ candidates: [candidate('P012', { cost: 11.2, costParts: null })] }))
    expect(m.candidates[0]).toMatchObject({ courier: null, pick: null, split: null, express: null, cost: '11.20' })
  })

  it('marks the actual and the best rows, the stock evidence, and the on-time state', () => {
    const m = explainModel(
      reply({
        candidates: [
          candidate('P002'),
          candidate('P007', { onTime: false, stockEvidence: 'estimated' }),
          candidate('P009', { onTime: null, stockEvidence: 'something-new' }),
        ],
      }),
    )
    expect(m.candidates.map((c) => [c.store, c.isActual, c.isBest, c.onTime, c.stock])).toEqual([
      ['P002 · Store P002', false, true, 'yes', 'recorded'],
      ['P007 · Store P007', true, false, 'no', 'estimated'],
      // An evidence the screen does not know is never claimed as recorded.
      ['P009 · Store P009', false, false, 'unknown', 'estimated'],
    ])
  })

  it('an unknown on-time state is never shown as a saving', () => {
    const unknownBest = reply({ best: { ...reply().best!, onTime: null } })
    expect(explainModel(unknownBest).best?.onTime).toBe('unknown')
    expect(explainModel(unknownBest).saving).toEqual({ shown: false })
    // A late best, a malformed on-time value, a zero saving and no best at all are no saving either.
    expect(explainModel(reply({ best: { ...reply().best!, onTime: false } })).saving).toEqual({ shown: false })
    expect(explainModel(reply({ best: { ...reply().best!, onTime: 'true' as unknown as boolean } })).saving).toEqual({ shown: false })
    expect(explainModel(reply({ saving: 0 })).saving).toEqual({ shown: false })
    expect(explainModel(reply({ best: null })).saving).toEqual({ shown: false })
  })

  it('reason codes map to keys, and an unknown code falls back', () => {
    const m = explainModel(reply({ reasons: ['NEARER_STORE_STOCKED', 'ACTUAL_LATE', 'AVOIDABLE_SPLIT', 'SOMETHING_NEW'] }))
    expect(m.reasons).toEqual([
      { code: 'NEARER_STORE_STOCKED', key: 'reasons.nearerStoreStocked' },
      { code: 'ACTUAL_LATE', key: 'reasons.actualLate' },
      { code: 'AVOIDABLE_SPLIT', key: 'reasons.avoidableSplit' },
      { code: 'SOMETHING_NEW', key: 'reasons.unknown' },
    ])
  })

  it('absent lists are read as empty, and a bare reply never crashes', () => {
    const bare = explainModel({ orderNo: '8000000253' } as Partial<SourcingExplainReply>)
    expect(bare.candidates).toEqual([])
    expect(bare.reasons).toEqual([])
    expect(bare.actual).toBeNull()
    expect(bare.best).toBeNull()
    expect(bare.saving).toEqual({ shown: false })
    expect(bare.placeholderRates).toBe(false)
    expect(explainModel(null).candidates).toEqual([])
  })

  it('keeps at most 15 candidate rows, in the order sent', () => {
    const many = Array.from({ length: 18 }, (_, i) => candidate(`P${100 + i}`))
    const m = explainModel(reply({ candidates: many }))
    expect(m.candidates).toHaveLength(15)
    expect(m.candidates[0].store.startsWith('P100')).toBe(true)
    expect(m.candidates[14].store.startsWith('P114')).toBe(true)
  })
})
