/**
 * What differs between two versions of a weight set (ticket 967; spec 4354 §10). The owner's default on the prototype:
 * the changed settings only, grouped. Fed the stub the drive serves (`stub-sets.json`, PROVISIONAL shapes).
 */
import { describe, expect, it } from 'vitest'
import type { WeightSetVersion } from '@/core/models/sourcing-run'
import stub from './stub-sets.json'
import { comparedPair, pickToCompare, versionDiff } from './version-diff-model'

const version = (name: string, v: number) => (stub.versions as WeightSetVersion[]).find((x) => x.name === name && x.version === v)!
const em4 = version('Express margin', 4).values
const em5 = version('Express margin', 5).values

describe('what differs between two versions', () => {
  it('shows only the changed settings, grouped weights → shelf chance, each with both values', () => {
    const groups = versionDiff(em4, em5)
    expect(groups.map((g) => g.group)).toEqual(['weights', 'shelf'])
    expect(groups[0].rows).toEqual([
      {
        key: 'feeWeight',
        group: 'weights',
        kind: 'number',
        before: 1,
        after: 0.75,
        changed: true,
      },
    ])
    expect(groups[1].rows.map((r) => [r.key, r.before, r.after])).toEqual([
      ['shelfChance.DAWAA_NOW.1.L0', 60, 58],
      ['shelfChance.DAWAA_NOW.1.L1', 81, 78.5],
      ['shelfChance.SLOT.1.L2', 88, 89.5],
      ['shelfChance.SLOT.2.L0', 55, 51.25],
      ['shelfChance.PICK_UP.1.L0', 43, 40],
    ])
  })

  it('names a shelf chance cell by its mode, units asked and units left over', () => {
    const [, shelf] = versionDiff(em4, em5)
    expect(shelf.rows[0]).toMatchObject({
      kind: 'percent',
      cell: { mode: 'DAWAA_NOW', asked: 1, leftOver: 'L0' },
    })
  })

  it('reads a setting a version does not hold at its starting value: no difference where none is', () => {
    // Version 5 does not hold `pickUpInDeliveryPlan`; version 4 holds it at its starting value, off.
    expect('pickUpInDeliveryPlan' in em5).toBe(false)
    const every = versionDiff(em4, em5, { every: true }).flatMap((g) => g.rows)
    expect(every.find((r) => r.key === 'pickUpInDeliveryPlan')).toMatchObject({
      before: false,
      after: false,
      changed: false,
    })
  })

  it('shows every setting on asking, in the panel order, with a key the screens do not know under "other"', () => {
    const groups = versionDiff(em4, em5, { every: true })
    expect(groups.map((g) => g.group)).toEqual(['weights', 'factors', 'reach', 'shelf', 'other'])
    expect(groups[0].rows.map((r) => r.key)).toEqual(['companyCostWeight', 'feeWeight', 'waitingPerHour', 'splitPenalty', 'mostShipments', 'marginMultiplier'])
    expect(groups[0].rows.find((r) => r.key === 'waitingPerHour')?.kind).toBe('riyals')
    expect(groups[1].rows.every((r) => r.kind === 'switch')).toBe(true)
    expect(groups[4].rows).toEqual([
      {
        key: 'pairCap',
        group: 'other',
        kind: 'number',
        before: 100,
        after: 100,
        changed: false,
      },
    ])
  })

  it('a key only one side holds and the screens do not know is a difference, the missing side empty', () => {
    const [other] = versionDiff({ pairCap: 100 }, { pairCap: 100, newSetting: 'X' })
    expect(other.rows).toEqual([
      {
        key: 'newSetting',
        group: 'other',
        kind: 'text',
        before: undefined,
        after: 'X',
        changed: true,
      },
    ])
  })

  it('two identical versions differ in nothing', () => {
    expect(versionDiff(em4, { ...em4 })).toEqual([])
  })
})

describe('picking two versions to compare', () => {
  const ref = (name: string, v: number) => ({ name, version: v })

  it('keeps the two picked last, and a second click takes a version out', () => {
    let picked = pickToCompare([], ref('Express margin', 5))
    picked = pickToCompare(picked, ref('Express margin', 4))
    picked = pickToCompare(picked, ref('Baseline', 1))
    expect(picked).toEqual([ref('Express margin', 4), ref('Baseline', 1)])
    expect(pickToCompare(picked, ref('Baseline', 1))).toEqual([ref('Express margin', 4)])
  })

  it('two versions of one set read older → newer, whatever order they were picked in; two sets in the picked order', () => {
    expect(comparedPair([ref('Express margin', 5), ref('Express margin', 4)])).toEqual({ from: ref('Express margin', 4), to: ref('Express margin', 5) })
    expect(comparedPair([ref('Wider slot reach', 2), ref('Baseline', 1)])).toEqual({ from: ref('Wider slot reach', 2), to: ref('Baseline', 1) })
    expect(comparedPair([ref('Baseline', 1)])).toBeNull()
  })
})
