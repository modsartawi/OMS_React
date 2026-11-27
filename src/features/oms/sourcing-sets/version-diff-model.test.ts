/**
 * What differs between two versions of a weight set (ticket 967; spec 4354 §10). The owner's default on the prototype:
 * the changed settings only, grouped. Fed the version door's replies the drive serves (`stub-sets.json`: the server's own
 * `baseline-weight-set.json`, BackOffice 4360 at pricing2 35a4e56be, with a few settings changed).
 */
import { describe, expect, it } from 'vitest'
import type { WeightSetValues, WeightSetVersion } from '@/core/models/sourcing-run'
import stub from './stub-sets.json'
import { comparedPair, flatValues, pickToCompare, versionDiff } from './version-diff-model'

const version = (name: string, v: number) => (stub.versions as unknown as WeightSetVersion[]).find((x) => x.name === name && x.version === v)!
const em4 = version('Express margin', 4).values
const em5 = version('Express margin', 5).values

describe('the document read flat', () => {
  it('names a mode row by its mode, a shelf chance cell as the server names the figure, and skips the name and version', () => {
    const flat = flatValues(em5)
    expect(flat['modes[SLOT].reachWidened']).toBe(false)
    expect(flat['goals[BALANCED].on']).toBe(true)
    expect(flat['shelfChance 2/0']).toBe(0.076)
    expect(flat['prices.feeWeight']).toBe(0.75)
    expect('name' in flat || 'version' in flat || 'formatVersion' in flat).toBe(false)
  })
})

describe('what differs between two versions', () => {
  it('shows only the changed settings, grouped weights → shelf chance → other, each with both values', () => {
    const groups = versionDiff(em4, em5)
    expect(groups.map((g) => g.group)).toEqual(['weights', 'shelf', 'other'])
    expect(groups[0].rows).toEqual([{ key: 'feeWeight', group: 'weights', kind: 'number', before: 1, after: 0.75, changed: true }])
    expect(groups[1].rows.map((r) => [r.key, r.before, r.after])).toEqual([
      ['shelfChance 1/0', 0.09, 0.085],
      ['shelfChance 2/0', 0.08, 0.076],
      ['shelfChance 1/1', 0.0301, 0.028],
      ['shelfChance 1/2', 0.021, 0.02],
    ])
    expect(groups[2].rows.map((r) => [r.key, r.before, r.after])).toEqual([['noStock.shortFigure.deliveryRows.bookAtZero', 0.22, 0.2]])
  })

  it('names a shelf chance cell by its units asked and units left over, its chance a fraction', () => {
    const [, shelf] = versionDiff(em4, em5)
    expect(shelf.rows[1]).toMatchObject({ kind: 'chance', cell: { asked: 2, leftOver: 0 } })
  })

  it('reads a panel setting at its place in the document: the slot reach of the wider set, the margin of every mode', () => {
    const rows = versionDiff(version('Baseline', 1).values, version('Wider slot reach', 2).values).flatMap((g) => g.rows)
    expect(rows.map((r) => [r.key, r.before, r.after])).toEqual([
      ['mostShipments', 3, 2],
      ['widerSlotReach', false, true],
    ])
    const margin = versionDiff(version('Express margin', 3).values, em4).flatMap((g) => g.rows).find((r) => r.key === 'marginMultiplier')
    expect(margin).toMatchObject({ before: 1.25, after: 1.1, kind: 'number' })
  })

  it('a control over several settings is changed when any one of them is, though its own value reads the same (review 3 #2)', () => {
    const changed = (to: WeightSetValues) =>
      versionDiff(em4, to)
        .flatMap((g) => g.rows)
        .filter((r) => r.changed)
        .map((r) => r.key)
    const modes = (em4.modes as Record<string, unknown>[]).map((m) =>
      m.mode === 'SLOT' ? { ...m, marginMultiplier: 1.25 } : m.mode === 'CARRIER_NEXT_DAY' ? { ...m, on: true } : m,
    )
    expect(changed({ ...em4, modes })).toEqual(['marginMultiplier', 'carrierModes'])
    const storeRecord = structuredClone(em4.storeRecord) as { slot: { late: { on: boolean } } }
    storeRecord.slot.late.on = false
    expect(changed({ ...em4, storeRecord })).toEqual(['storeRecord'])
  })

  it('a setting a panel control covers is never listed again under "other"', () => {
    const every = versionDiff(em4, em5, { every: true })
    const other = every.find((g) => g.group === 'other')!.rows.map((r) => r.key)
    expect(other).not.toContain('prices.feeWeight')
    expect(other).not.toContain('modes[SLOT].marginMultiplier')
    expect(other).not.toContain('storeRecord.slot.late.on')
    expect(other).toContain('limits.mostPairs')
  })

  it('shows every setting on asking, in the panel order', () => {
    const groups = versionDiff(em4, em5, { every: true })
    expect(groups.map((g) => g.group)).toEqual(['weights', 'factors', 'reach', 'shelf', 'other'])
    expect(groups[0].rows.map((r) => r.key)).toEqual(['companyCostWeight', 'feeWeight', 'waitingPerHour', 'splitPenalty', 'mostShipments', 'marginMultiplier'])
    expect(groups[0].rows.find((r) => r.key === 'waitingPerHour')).toMatchObject({ kind: 'riyals', before: 6.5, after: 6.5 })
    expect(groups[1].rows.every((r) => r.kind === 'switch')).toBe(true)
  })

  it('a setting only one side holds is a difference, the missing side empty', () => {
    const [other] = versionDiff({ limits: { mostPairs: 100 } }, { limits: { mostPairs: 100, newSetting: 'X' } }).filter((g) => g.group === 'other')
    expect(other.rows).toEqual([{ key: 'limits.newSetting', group: 'other', kind: 'text', before: undefined, after: 'X', changed: true }])
  })

  it('two identical versions differ in nothing, whatever their names', () => {
    expect(versionDiff(em4, { ...em4, name: 'Copy', version: 1 })).toEqual([])
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
