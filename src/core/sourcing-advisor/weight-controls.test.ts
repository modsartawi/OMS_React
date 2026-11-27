/**
 * The weight set panel's settings over the real weight-set document (BackOffice 4360 `baseline-weight-set.json`, at
 * pricing2 35a4e56be): each control reads and writes its place in the nested document, never a key of its own.
 */
import { describe, expect, it } from 'vitest'
import { controlValue, readSetting, WEIGHT_CONTROLS, withControl, writeSetting } from './weight-controls'

/** The parts of the baseline document the panel touches, as the version door answers them. */
const doc = () => ({
  formatVersion: 1,
  name: 'Baseline',
  version: 1,
  modes: [
    { mode: 'DAWAA_NOW', on: true, reachWidened: false, marginMultiplier: 1.0 },
    { mode: 'SLOT', on: true, reachWidened: false, marginMultiplier: 1.0 },
    { mode: 'CARRIER_SAME_DAY', on: false, reachWidened: false, marginMultiplier: 1.0 },
    { mode: 'CARRIER_NEXT_DAY', on: false, reachWidened: false, marginMultiplier: 1.0 },
  ],
  waiting: { firstHours: 4, firstPerHour: 5.0, laterPerHour: 0.5, source: 'ASSUMED' },
  prices: { companyCostWeight: 1, feeWeight: 1, handling: 2.0, handlingSource: 'ASSUMED', splitPenalty: 0.0 },
  limits: { mostShipments: 3, mostPairs: 100, workBudget: 1000, weightLimitOn: false },
  stock: { bufferOn: true, risk: 0.05, caution: 1.5, confidenceOn: true },
  pickUpWithDelivery: false,
  feePerOrder: false,
  storeRecord: {
    steadyingCount: 30,
    slot: { late: { on: true, failurePrice: 10 }, returned: { on: true, failurePrice: 25 }, cancelled: { on: true, failurePrice: 30 } },
    pickUp: { neverReady: { on: true, failurePrice: 30 }, cancelled: { on: true, failurePrice: 30 }, readyLate: { on: true, failurePrice: 2 } },
    dawaaNow: { calloutIgnored: { on: true, failurePrice: 2 }, late: { on: false, failurePrice: 10 } },
  },
})

const control = (key: string) => WEIGHT_CONTROLS.find((c) => c.key === key)!

describe('a setting by its path in the document', () => {
  it('reads a nested setting and a mode row by its mode', () => {
    expect(readSetting(doc(), 'prices.companyCostWeight')).toBe(1)
    expect(readSetting(doc(), 'modes[SLOT].reachWidened')).toBe(false)
    expect(readSetting(doc(), 'modes[CARRIER_NEXT_DAY].on')).toBe(false)
    expect(readSetting(doc(), 'prices.nothing')).toBeUndefined()
  })

  it('writes without touching the document it was given', () => {
    const before = doc()
    const after = writeSetting(before, 'modes[SLOT].reachWidened', true)
    expect(readSetting(after, 'modes[SLOT].reachWidened')).toBe(true)
    expect(readSetting(before, 'modes[SLOT].reachWidened')).toBe(false)
    expect(readSetting(after, 'modes[DAWAA_NOW].reachWidened')).toBe(false)
  })

  it('writes every mode row at once through [*]', () => {
    const after = writeSetting(doc(), 'modes[*].marginMultiplier', 1.25)
    expect((after.modes as { marginMultiplier: number }[]).map((m) => m.marginMultiplier)).toEqual([1.25, 1.25, 1.25, 1.25])
  })
})

describe('the panel\'s controls over the real document', () => {
  it('each slider reads the setting the server names', () => {
    expect(controlValue(doc(), control('companyCostWeight'))).toBe(1)
    expect(controlValue(doc(), control('waitingPerHour'))).toBe(5)
    expect(controlValue(doc(), control('mostShipments'))).toBe(3)
    expect(controlValue(doc(), control('marginMultiplier'))).toBe(1)
  })

  it('a slider writes its place: waiting is the first hours\' rate, the margin every mode\'s', () => {
    expect(readSetting(withControl(doc(), control('waitingPerHour'), 6.5), 'waiting.firstPerHour')).toBe(6.5)
    expect(readSetting(withControl(doc(), control('splitPenalty'), 2), 'prices.splitPenalty')).toBe(2)
    const m = withControl(doc(), control('marginMultiplier'), 1.5)
    expect(readSetting(m, 'modes[DAWAA_NOW].marginMultiplier')).toBe(1.5)
    expect(readSetting(m, 'modes[CARRIER_NEXT_DAY].marginMultiplier')).toBe(1.5)
  })

  it('a factor switch reads and writes its "on"', () => {
    expect(controlValue(doc(), control('buffer'))).toBe(true)
    expect(readSetting(withControl(doc(), control('buffer'), false), 'stock.bufferOn')).toBe(false)
    expect(readSetting(withControl(doc(), control('stockConfidence'), false), 'stock.confidenceOn')).toBe(false)
    expect(readSetting(withControl(doc(), control('pickUpInDeliveryPlan'), true), 'pickUpWithDelivery')).toBe(true)
    expect(readSetting(withControl(doc(), control('feePerOrder'), true), 'feePerOrder')).toBe(true)
    expect(readSetting(withControl(doc(), control('widerSlotReach'), true), 'modes[SLOT].reachWidened')).toBe(true)
  })

  it('the carrier modes switch turns both carrier modes', () => {
    expect(controlValue(doc(), control('carrierModes'))).toBe(false)
    const on = withControl(doc(), control('carrierModes'), true)
    expect([readSetting(on, 'modes[CARRIER_SAME_DAY].on'), readSetting(on, 'modes[CARRIER_NEXT_DAY].on')]).toEqual([true, true])
    expect(readSetting(on, 'modes[DAWAA_NOW].on')).toBe(true)
  })

  it('the store record switch is on while any measure is; off turns every measure off, on puts back the version\'s own', () => {
    const base = doc()
    expect(controlValue(base, control('storeRecord'))).toBe(true)
    const off = withControl(base, control('storeRecord'), false, base)
    expect(controlValue(off, control('storeRecord'))).toBe(false)
    expect(readSetting(off, 'storeRecord.slot.late.on')).toBe(false)
    const back = withControl(off, control('storeRecord'), true, base)
    expect(back).toEqual(base)
    expect(readSetting(back, 'storeRecord.dawaaNow.late.on')).toBe(false)
  })

  it('a version holding no measure on, switched on, turns every measure on', () => {
    const allOff = withControl(doc(), control('storeRecord'), false)
    expect(readSetting(withControl(allOff, control('storeRecord'), true, allOff), 'storeRecord.dawaaNow.late.on')).toBe(true)
  })

  it('a mode switch on a document without the mode\'s row adds the row, so the switch stays on (review 3 #3)', () => {
    const slotOnly = { modes: [{ mode: 'SLOT', on: true, reachWidened: false, marginMultiplier: 1.0 }] }
    const on = withControl(slotOnly, control('carrierModes'), true)
    expect(on.modes).toEqual([
      { mode: 'SLOT', on: true, reachWidened: false, marginMultiplier: 1.0 },
      { mode: 'CARRIER_SAME_DAY', on: true },
      { mode: 'CARRIER_NEXT_DAY', on: true },
    ])
    expect(controlValue(on, control('carrierModes'))).toBe(true)
    expect(withControl({}, control('widerSlotReach'), true)).toEqual({ modes: [{ mode: 'SLOT', reachWidened: true }] })
  })

  it('a setting of every mode on a document with no modes makes no empty list (review 3 #3)', () => {
    expect(withControl({ prices: {} }, control('marginMultiplier'), 1.5)).toEqual({ prices: {} })
  })

  it('the margin slider moved back to the version\'s own value puts back each mode\'s own margin (review 3 #4)', () => {
    const base = writeSetting(doc(), 'modes[SLOT].marginMultiplier', 1.25)
    const moved = withControl(base, control('marginMultiplier'), 1.5, base)
    expect(readSetting(moved, 'modes[SLOT].marginMultiplier')).toBe(1.5)
    expect(withControl(moved, control('marginMultiplier'), 1.0, base)).toEqual(base)
  })

  it('a control put back on a setting the version never held takes the setting out again (review 3 #1)', () => {
    const { limits: _limits, ...base } = doc()
    const set = withControl(base, control('mostShipments'), 2, base)
    expect(readSetting(set, 'limits.mostShipments')).toBe(2)
    expect(withControl(set, control('mostShipments'), 3, base)).toEqual(base)
    const carriers = withControl({}, control('carrierModes'), true, {})
    expect(withControl(carriers, control('carrierModes'), false, {})).toEqual({})
  })

  it('a setting the document does not hold reads at the control\'s starting value', () => {
    expect(controlValue({}, control('feeWeight'))).toBe(1)
    expect(controlValue({}, control('carrierModes'))).toBe(false)
  })
})
