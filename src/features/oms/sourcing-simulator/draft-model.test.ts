/**
 * Ticket 963 (BackOffice spec 4354 §10; 4281 decision 16; BackOffice 4243 decisions 19, 26): the weight set panel's
 * draft. A changed value makes a draft holding the whole set, sent as `{ draft: { basedOn, values } }`, and marks
 * "changed, not saved"; put back, the panel names the saved version again. "Save as a named set" sends the whole draft.
 */
import { describe, expect, it } from 'vitest'
import type { WeightSetVersion } from '@/core/models/sourcing-run'
import { controlValue, isChanged, openDraft, saveRequest, setValue, waitsForSet, WEIGHT_CONTROLS, weightSetRef } from './draft-model'

/** A saved version as the version door answers it (BO 4360 `WeightSetVersionReply`): the whole nested document. */
const baseline: WeightSetVersion = {
  name: 'Baseline',
  version: 1,
  owner: '',
  retired: false,
  savedBy: 'seed',
  savedAt: '2026-10-01 00:00:00',
  change: 'Seed values of spec 4354',
  formatVersion: 1,
  candidate: true,
  trial: false,
  filledFromBaseline: [],
  values: {
    formatVersion: 1,
    name: 'Baseline',
    version: 1,
    modes: [{ mode: 'SLOT', on: true, reachWidened: false, marginMultiplier: 1.0 }],
    waiting: { firstHours: 4, firstPerHour: 5.0, laterPerHour: 0.5, source: 'ASSUMED' },
    prices: { companyCostWeight: 1, feeWeight: 1, handling: 2.0, handlingSource: 'ASSUMED', splitPenalty: 0.0 },
    stock: { bufferOn: true, risk: 0.05, caution: 1.5, confidenceOn: true },
    leftOut: [{ store: '1203', reason: 'refit' }],
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
      draft: {
        basedOn: { name: 'Baseline', version: 1 },
        values: { ...baseline.values, prices: { ...(baseline.values.prices as object), companyCostWeight: 1.5 } },
      },
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

  it('a setting the version never held, set and put back, leaves nothing changed and names the version (review 3 #1)', () => {
    const back = setValue(setValue(openDraft(baseline), 'mostShipments', 2), 'mostShipments', 3)
    expect(isChanged(back)).toBe(false)
    expect(weightSetRef(back)).toEqual({ name: 'Baseline', version: 1 })
    const off = setValue(setValue(openDraft(baseline), 'feePerOrder', true), 'feePerOrder', false)
    expect(isChanged(off)).toBe(false)
  })

  it('a switch writes the document\'s own setting: the buffer is `stock.bufferOn`', () => {
    expect((setValue(openDraft(baseline), 'buffer', false).values.stock as { bufferOn: boolean }).bufferOn).toBe(false)
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

describe('save as a named set (BO 4360 `POST WeightSets/Copy`, with values)', () => {
  it('copies the version it came from under the new name, holding the whole draft', () => {
    const d = setValue(openDraft(baseline), 'waitingPerHour', 7)
    expect(saveRequest(d, '  Late evenings  ')).toEqual({
      from: { name: 'Baseline', version: 1 },
      name: 'Late evenings',
      values: { ...baseline.values, waiting: { ...(baseline.values.waiting as object), firstPerHour: 7 } },
    })
  })

  it('a blank name saves nothing', () => {
    expect(saveRequest(openDraft(baseline), '   ')).toBeNull()
  })
})

describe('Run waits for the weight set (review 4354 #7)', () => {
  const reading = { draft: false, setsRead: false, setsFailed: false, chosen: false, versionFailed: false }

  it('waits while the sets, or the chosen version, are still being read — a run then would name no set', () => {
    expect(waitsForSet(reading)).toBe(true)
    expect(waitsForSet({ ...reading, setsRead: true, chosen: true })).toBe(true)
  })

  it('runs once the draft is open', () => {
    expect(waitsForSet({ ...reading, setsRead: true, chosen: true, draft: true })).toBe(false)
  })

  it('never waits on a read that failed, nor when there is no set to read: the door then plans on the candidate set', () => {
    expect(waitsForSet({ ...reading, setsFailed: true })).toBe(false)
    expect(waitsForSet({ ...reading, setsRead: true, chosen: true, versionFailed: true })).toBe(false)
    expect(waitsForSet({ ...reading, setsRead: true, chosen: false })).toBe(false)
  })
})
