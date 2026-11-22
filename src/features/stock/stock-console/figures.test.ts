import { describe, expect, it } from 'vitest'
import { flagLines, freeLabel, reservedView, stageWord, statusPill } from './figures'
import { flag, storeRow as row } from './test-rows'

describe('the status pill', () => {
  it('OK, Watch and Problem take their own severity and words', () => {
    expect(statusPill('Ok')).toEqual({ sev: 'ok', key: 'status.Ok' })
    expect(statusPill('Watch')).toEqual({ sev: 'warn', key: 'status.Watch' })
    expect(statusPill('Problem')).toEqual({ sev: 'bad', key: 'status.Problem' })
  })

  it('🚩 a status the console does not know is drawn as it came, as a Watch — never as OK', () => {
    expect(statusPill('Degraded')).toEqual({ sev: 'warn', raw: 'Degraded' })
  })
})

describe('the pill’s flag lines', () => {
  it('each flag says its value in its own sentence, and its limit', () => {
    expect(flagLines([flag('SapQuiet', 'Watch', 31, 24)])).toEqual([
      { code: 'SapQuiet', sev: 'warn', key: 'flag.SapQuiet', value: 31, limit: { key: 'flag.limit', value: 24 } },
    ])
  })

  it('a flag whose limit is "any" says so', () => {
    expect(flagLines([flag('ComparisonDiffers', 'Problem', 3, null)])).toEqual([
      { code: 'ComparisonDiffers', sev: 'bad', key: 'flag.ComparisonDiffers', value: 3, limit: { key: 'flag.limitAny' } },
    ])
  })

  it('Problem flags come first, the rest in the order the server sent them', () => {
    const lines = flagLines([flag('OldHold', 'Watch', 3, 2), flag('SapQuiet', 'Watch', 30, 24), flag('BelowZero', 'Problem', 600, 500)])
    expect(lines.map((l) => [l.code, l.sev])).toEqual([
      ['BelowZero', 'bad'],
      ['OldHold', 'warn'],
      ['SapQuiet', 'warn'],
    ])
  })

  it('a flag with no measured value is named without a figure', () => {
    expect(flagLines([flag('PlaceholderStock', 'Watch', null, null)])[0]).toEqual({
      code: 'PlaceholderStock',
      sev: 'warn',
      key: 'flagName.PlaceholderStock',
      value: null,
      limit: { key: 'flag.limitAny' },
    })
  })

  it('🚩 a flag the console does not know still draws, by its code, as a Watch', () => {
    expect(flagLines([flag('NewThing', 'Odd', 7, 5)])).toEqual([
      { code: 'NewThing', sev: 'warn', key: 'flag.unknown', value: 7, limit: { key: 'flag.limit', value: 5 } },
    ])
  })
})

describe('reserved’s three states', () => {
  it('🚩 never computed is "not computed", never a zero', () => {
    expect(reservedView(row({ reservedState: 'NeverComputed', reserved: null }))).toEqual({ kind: 'notComputed' })
  })

  it('no figure at all is "not computed" too, whatever state it claims', () => {
    expect(reservedView(row({ reservedState: 'Computed', reserved: null, reservedAt: '2026-11-22T09:58:00' }))).toEqual({
      kind: 'notComputed',
    })
  })

  it('stale is the figure with a stale mark and its time', () => {
    expect(reservedView(row({ reservedState: 'Stale', reserved: 15, reservedAt: '2026-11-22T08:00:00' }))).toEqual({
      kind: 'stale',
      value: 15,
      at: '2026-11-22T08:00:00',
    })
  })

  it('computed is the figure and its time — a zero computed is a real zero', () => {
    expect(reservedView(row({ reservedState: 'Computed', reserved: 0, reservedAt: '2026-11-22T09:58:00' }))).toEqual({
      kind: 'value',
      value: 0,
      at: '2026-11-22T09:58:00',
    })
  })
})

describe('free’s label', () => {
  it('says "reserved not included" when reserved is not in it', () => {
    expect(freeLabel(row({ reservedIncluded: false, reservedState: 'NeverComputed', reserved: null }))).toBe('reservedNotIncluded')
  })

  it('says nothing when reserved is in it', () => {
    expect(freeLabel(row({ reservedIncluded: true, reservedState: 'Computed', reserved: 4 }))).toBeNull()
    expect(freeLabel(row({ reservedIncluded: true, reservedState: 'Stale', reserved: 4 }))).toBeNull()
  })

  it('🚩 never claims reserved is in it while reserved shows "not computed"', () => {
    expect(freeLabel(row({ reservedIncluded: true, reservedState: 'NeverComputed', reserved: null }))).toBe('reservedNotIncluded')
  })
})

describe('a store’s stage', () => {
  it('the four stages in the console’s words', () => {
    expect(['Shadow', 'Seeding', 'Seeded', 'Blocking'].map((s) => stageWord(s))).toEqual([
      { key: 'stage.Shadow' },
      { key: 'stage.Seeding' },
      { key: 'stage.Seeded' },
      { key: 'stage.Blocking' },
    ])
  })

  it('a stage the console does not know as it came — never a raw key', () => {
    expect(stageWord('Frozen')).toEqual({ raw: 'Frozen' })
    expect(stageWord(null)).toEqual({ raw: '' })
  })
})
