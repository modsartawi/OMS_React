/**
 * Oms 924 (BackOffice 4055) — the seven pattern thresholds are validated on the page against ONE ranges table, so an
 * out-of-range value is refused before any call. The expected bounds below are BackOffice 4055's own list, written out
 * here, never read from the table under test:
 *
 *   WindowDays 1–30, MinStores 2–10, MaxKmPerHour 30–500, MinTravelKm 1–500, OverlapShare 0.05–0.9,
 *   CaseQuietDays 7–90, LookbackDays 30–365.
 */
import { describe, expect, it } from 'vitest'
import type { PatternSetting, PatternSettings } from '@/core/models/insurance-pattern-manager'
import { changedSettings, draftsOf, editsAfterSave, SETTING_NAMES, settingProblem, settingsAfterSave, settingsBody } from './settings'

/** [name, low bound, high bound, one step below the low, one step above the high] — as typed into the field. */
const BO_4055 = [
  ['WindowDays', '1', '30', '0', '31'],
  ['MinStores', '2', '10', '1', '11'],
  ['MaxKmPerHour', '30', '500', '29', '501'],
  ['MinTravelKm', '1', '500', '0', '501'],
  ['OverlapShare', '0.05', '0.9', '0.04', '0.91'],
  ['CaseQuietDays', '7', '90', '6', '91'],
  ['LookbackDays', '30', '365', '29', '366'],
] as const

describe('the one ranges table', () => {
  it('names the seven settings of BackOffice 4055, in the screen’s order', () => {
    expect(SETTING_NAMES).toEqual(BO_4055.map(([name]) => name))
  })

  it.each(BO_4055)('%s accepts its low bound %s and its high bound %s', (name, low, high) => {
    expect(settingProblem(name, low)).toBeNull()
    expect(settingProblem(name, high)).toBeNull()
  })

  it.each(BO_4055)('%s (%s–%s) refuses %s below its low bound and %s above its high bound', (name, _low, _high, below, above) => {
    expect(settingProblem(name, below)).toBe('outOfRange')
    expect(settingProblem(name, above)).toBe('outOfRange')
  })
})

describe('a value that is not a number in range', () => {
  it('a blank field is missing, whatever its spaces', () => {
    expect(settingProblem('WindowDays', '')).toBe('missing')
    expect(settingProblem('OverlapShare', '   ')).toBe('missing')
  })

  it('words are not a number', () => {
    expect(settingProblem('MinStores', 'three')).toBe('notNumber')
  })

  it('the days and the pharmacies are whole numbers; the share is a fraction', () => {
    expect(settingProblem('WindowDays', '7.5')).toBe('notWhole')
    expect(settingProblem('MinStores', '2.5')).toBe('notWhole')
    expect(settingProblem('LookbackDays', '90.25')).toBe('notWhole')
    expect(settingProblem('OverlapShare', '0.25')).toBeNull()
  })

  it('surrounding spaces do not count against a value', () => {
    expect(settingProblem('CaseQuietDays', ' 30 ')).toBeNull()
  })
})

/** The thresholds as the server holds them: BackOffice 4051's defaults, and a name the page does not know. */
const SAVED: PatternSetting[] = [
  { name: 'WindowDays', value: 7 },
  { name: 'MinStores', value: 3 },
  { name: 'MaxKmPerHour', value: 120 },
  { name: 'MinTravelKm', value: 50 },
  { name: 'OverlapShare', value: 0.25 },
  { name: 'CaseQuietDays', value: 30 },
  { name: 'LookbackDays', value: 90 },
  { name: 'SomeLaterThreshold', value: 5 },
]

describe('what a save sends', () => {
  it('the fields open on the saved values; a name the page does not know gets no field', () => {
    expect(draftsOf(SAVED)).toEqual({
      WindowDays: '7',
      MinStores: '3',
      MaxKmPerHour: '120',
      MinTravelKm: '50',
      OverlapShare: '0.25',
      CaseQuietDays: '30',
      LookbackDays: '90',
    })
  })

  it('nothing changed: nothing is sent', () => {
    expect(changedSettings(draftsOf(SAVED), SAVED)).toEqual([])
    expect(settingsBody(draftsOf(SAVED), SAVED)).toBeNull()
  })

  it('only the thresholds that changed, as numbers, in the table’s order', () => {
    const drafts = { ...draftsOf(SAVED), OverlapShare: '0.3', WindowDays: '10' }
    expect(changedSettings(drafts, SAVED)).toEqual(['WindowDays', 'OverlapShare'])
    expect(settingsBody(drafts, SAVED)).toEqual({
      settings: [
        { name: 'WindowDays', value: 10 },
        { name: 'OverlapShare', value: 0.3 },
      ],
    })
  })

  it('the same number typed another way is no change', () => {
    const drafts = { ...draftsOf(SAVED), WindowDays: ' 7.0 ', OverlapShare: '0.250' }
    expect(changedSettings(drafts, SAVED)).toEqual([])
    expect(settingsBody(drafts, SAVED)).toBeNull()
  })

  it('one value out of range holds the whole save, the changed ones too', () => {
    const drafts = { ...draftsOf(SAVED), WindowDays: '10', MinStores: '11' }
    expect(changedSettings(drafts, SAVED)).toEqual(['WindowDays', 'MinStores'])
    expect(settingsBody(drafts, SAVED)).toBeNull()
  })

  it('a threshold the server sent no number for opens blank, holds the save, and is sent once typed', () => {
    const saved = SAVED.map((s) => (s.name === 'MinTravelKm' ? { ...s, value: null } : s))
    const drafts = draftsOf(saved)
    expect(drafts.MinTravelKm).toBe('')
    expect(settingsBody(drafts, saved)).toBeNull()
    expect(settingsBody({ ...drafts, MinTravelKm: '60' }, saved)).toEqual({ settings: [{ name: 'MinTravelKm', value: 60 }] })
  })
})

/** The page's settings before a save: the seven defaults and their change log. */
const HELD: PatternSettings = {
  settings: SAVED.slice(0, 7),
  changes: [{ name: 'MinStores', oldValue: 4, newValue: 3, by: 'manager2', at: '2026-11-10T14:05:00' }],
}
const SENT = { settings: [{ name: 'WindowDays', value: 10 }] }

describe('what the page holds after a save (review 6)', () => {
  it('the PUT’s answer, when it names every threshold as the GET does', () => {
    const answer: PatternSettings = {
      settings: [{ name: 'WindowDays', value: 10 }, ...SAVED.slice(1, 7)],
      changes: [...HELD.changes, { name: 'WindowDays', oldValue: 7, newValue: 10, by: 'msartawi', at: '2026-11-19T18:10:00' }],
    }
    expect(settingsAfterSave(HELD, SENT, answer)).toEqual(answer)
  })

  it('an answer with only the threshold it changed never blanks the others: what was held, with the values sent', () => {
    const answer: PatternSettings = { settings: [{ name: 'WindowDays', value: 10 }], changes: [] }
    expect(settingsAfterSave(HELD, SENT, answer)).toEqual({
      settings: [
        { name: 'WindowDays', value: 10 },
        { name: 'MinStores', value: 3 },
        { name: 'MaxKmPerHour', value: 120 },
        { name: 'MinTravelKm', value: 50 },
        { name: 'OverlapShare', value: 0.25 },
        { name: 'CaseQuietDays', value: 30 },
        { name: 'LookbackDays', value: 90 },
      ],
      changes: HELD.changes,
    })
  })

  it('a threshold answered with no number counts as not answered; an empty answer too', () => {
    const noNumber: PatternSettings = { settings: [{ name: 'WindowDays', value: 10 }, ...SAVED.slice(1, 6), { name: 'LookbackDays', value: null }], changes: [] }
    expect(settingsAfterSave(HELD, SENT, noNumber).settings.find((s) => s.name === 'LookbackDays')).toEqual({ name: 'LookbackDays', value: 90 })
    expect(settingsAfterSave(HELD, SENT, { settings: [], changes: [] }).settings).toHaveLength(7)
  })

  it('a value sent for a threshold the page held no row for is held from now on', () => {
    const held: PatternSettings = { settings: SAVED.slice(0, 3), changes: [] }
    const sent = { settings: [{ name: 'MinTravelKm', value: 60 }] }
    expect(settingsAfterSave(held, sent, { settings: [], changes: [] }).settings).toEqual([...SAVED.slice(0, 3), { name: 'MinTravelKm', value: 60 }])
  })
})

describe('the fields after a save (review 8)', () => {
  const sentDrafts = { ...draftsOf(SAVED), WindowDays: '10' }

  it('a field that still holds what was sent goes back to reading the saved value', () => {
    expect(editsAfterSave({ WindowDays: '10' }, sentDrafts)).toEqual({})
  })

  it('a field typed while the save was in flight keeps what was typed', () => {
    expect(editsAfterSave({ WindowDays: '10', LookbackDays: '120' }, sentDrafts)).toEqual({ LookbackDays: '120' })
    expect(editsAfterSave({ WindowDays: '11' }, sentDrafts)).toEqual({ WindowDays: '11' })
  })
})
