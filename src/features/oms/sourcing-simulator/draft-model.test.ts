/**
 * Ticket 963 (BackOffice spec 4354 §10; 4281 decision 16; BackOffice 4243 decisions 19, 26): the weight set panel's
 * draft. A changed value makes a draft holding the whole set, sent as `{ draft: { basedOn, values } }`, and marks
 * "changed, not saved"; put back, the panel names the saved version again. "Save as a named set" sends the whole draft.
 */
import { describe, expect, it } from 'vitest'
import type { WeightSetVersion } from '@/core/models/sourcing-run'
import { controlValue, isChanged, openDraft, saveRequest, setValue, WEIGHT_CONTROLS, weightSetRef } from './draft-model'

/** A saved version as the read door would give it: the panel's values and settings the panel does not show. */
const baseline: WeightSetVersion = {
  name: 'Baseline',
  version: 1,
  candidate: true,
  trial: false,
  values: {
    companyCostWeight: 1,
    feeWeight: 1,
    waitingPerHour: 5,
    splitPenalty: 0,
    mostShipments: 3,
    marginMultiplier: 1,
    buffer: true,
    stockConfidence: true,
    storeRecord: true,
    widerSlotReach: false,
    carrierModes: false,
    feePerOrder: false,
    pickUpInDeliveryPlan: false,
    coverPrice: 1,
    failurePrices: { late: 4, returned: 9 },
    storesLeftOut: [{ store: '1203', reason: 'refit' }],
  },
}

describe('the draft', () => {
  it('opened on a saved version, nothing is changed and the request names the version', () => {
    const d = openDraft(baseline)
    expect(isChanged(d)).toBe(false)
    expect(weightSetRef(d)).toEqual({ name: 'Baseline', version: 1 })
  })

  it('a changed weight marks "changed, not saved" and sends the whole set as a draft, the unseen settings too', () => {
    const d = setValue(openDraft(baseline), 'companyCostWeight', 1.5)
    expect(isChanged(d)).toBe(true)
    expect(weightSetRef(d)).toEqual({
      draft: { basedOn: { name: 'Baseline', version: 1 }, values: { ...baseline.values, companyCostWeight: 1.5 } },
    })
  })

  it('a switched factor is a change; switched back, the draft is the saved version again', () => {
    const off = setValue(openDraft(baseline), 'buffer', false)
    expect(isChanged(off)).toBe(true)
    expect(controlValue(off.values, WEIGHT_CONTROLS.find((c) => c.key === 'buffer')!)).toBe(false)
    const back = setValue(off, 'buffer', true)
    expect(isChanged(back)).toBe(false)
    expect(weightSetRef(back)).toEqual({ name: 'Baseline', version: 1 })
  })

  it('a setting the version does not hold reads at its starting value, and moving it is a change', () => {
    const older: WeightSetVersion = { ...baseline, name: 'Old', version: 2, values: { companyCostWeight: 1 } }
    const fee = WEIGHT_CONTROLS.find((c) => c.key === 'feeWeight')!
    expect(controlValue(older.values, fee)).toBe(1)
    expect(isChanged(setValue(openDraft(older), 'feeWeight', 0.5))).toBe(true)
  })
})

describe('the panel', () => {
  it('has Weights, Factors, and Reach and shape, with one fee per order as a switch', () => {
    expect([...new Set(WEIGHT_CONTROLS.map((c) => c.group))]).toEqual(['weights', 'factors', 'reach'])
    expect(WEIGHT_CONTROLS.find((c) => c.key === 'feePerOrder')).toMatchObject({ group: 'reach', kind: 'switch' })
    expect(WEIGHT_CONTROLS.filter((c) => c.group === 'weights').every((c) => c.kind === 'slider')).toBe(true)
  })

  it('has no switch for pricing waiting on each shipment (spec 4354 Further Notes: waiting is priced on the last)', () => {
    expect(WEIGHT_CONTROLS.some((c) => /wait/i.test(c.key) && c.kind === 'switch')).toBe(false)
  })
})

describe('save as a named set', () => {
  it('sends the new name, the version it came from and the whole draft', () => {
    const d = setValue(openDraft(baseline), 'waitingPerHour', 7)
    expect(saveRequest(d, '  Late evenings  ')).toEqual({
      name: 'Late evenings',
      basedOn: { name: 'Baseline', version: 1 },
      values: { ...baseline.values, waitingPerHour: 7 },
    })
  })

  it('a blank name saves nothing', () => {
    expect(saveRequest(openDraft(baseline), '   ')).toBeNull()
  })
})
