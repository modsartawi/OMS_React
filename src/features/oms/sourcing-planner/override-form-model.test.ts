/**
 * Ticket 968 (BackOffice spec 4354 §5, BO 4375): a planner's buffer override says "keep N units", "keep D days of
 * walk-in sales", or both (the larger applies, on the server). Four levels, the most specific wins: store and item,
 * item, merchandise category, store. A first day, an optional last day, a reason. The server's checks
 * (BackOffice 4375 `PlannerStockService`, pricing2 35a4e56be) are read here first.
 */
import { describe, expect, it } from 'vitest'
import type { PlannerRow } from './wire'
import {
  blankOverrideForm,
  levelsBeaten,
  overrideFormOf,
  overrideKeep,
  overrideProblems,
  overrideThatApplies,
  overrideValues,
  type OverrideForm,
} from './override-form-model'

const form = (over: Partial<OverrideForm> = {}): OverrideForm => ({
  ...blankOverrideForm('2026-11-27'),
  store: 'P905',
  item: '121007',
  ...over,
})

const row = (id: string, values: Record<string, unknown>, over: Partial<PlannerRow> = {}): PlannerRow => ({
  id,
  key: id,
  values: { store: null, item: null, category: null, keepUnits: null, keepDays: null, lastDay: null, firstDay: '2026-11-01', ...values } as PlannerRow['values'],
  setAt: '2026-11-01 08:00:00',
  setBy: 'n.alharbi',
  ...over,
})

describe('units or days or both', () => {
  it('reads units alone, days alone, or both', () => {
    expect(overrideKeep(form({ keepUnits: '4' }))).toBe('UNITS')
    expect(overrideKeep(form({ keepDays: '1.5' }))).toBe('DAYS')
    expect(overrideKeep(form({ keepUnits: '3', keepDays: '1' }))).toBe('BOTH')
    expect(overrideKeep(form())).toBeNull()
  })

  it('refuses an override that keeps neither units nor days', () => {
    expect(overrideProblems(form())).toEqual(['unitsOrDays'])
    expect(overrideValues(form())).toBeNull()
  })

  it('takes zero units as an override (it offers every unit), not as a blank', () => {
    expect(overrideKeep(form({ keepUnits: '0' }))).toBe('UNITS')
    expect(overrideProblems(form({ keepUnits: '0' }))).toEqual([])
  })

  it('refuses a negative figure or units that are not whole', () => {
    expect(overrideProblems(form({ keepUnits: '-1' }))).toEqual(['badUnits'])
    expect(overrideProblems(form({ keepUnits: '2.5' }))).toEqual(['badUnits'])
    expect(overrideProblems(form({ keepDays: '-0.5' }))).toEqual(['badDays'])
  })

  it('refuses more than 365 days or more than two decimals, as the server does', () => {
    expect(overrideProblems(form({ keepDays: '365' }))).toEqual([])
    expect(overrideProblems(form({ keepDays: '365.5' }))).toEqual(['badDays'])
    expect(overrideProblems(form({ keepDays: '1.255' }))).toEqual(['badDays'])
  })

  it('sends both figures as numbers, and a blank one as null', () => {
    expect(overrideValues(form({ keepUnits: '3', keepDays: '1.5' }))).toMatchObject({ keepUnits: 3, keepDays: 1.5 })
    expect(overrideValues(form({ keepDays: '2' }))).toMatchObject({ keepUnits: null, keepDays: 2 })
  })
})

describe('the level and its target', () => {
  it('asks for the store and the item at store-and-item level', () => {
    expect(overrideProblems(form({ store: '', item: '', keepUnits: '1' }))).toEqual(['needStore', 'needItem'])
  })

  it('sends only the target fields its level names', () => {
    expect(overrideValues(form({ level: 'ITEM', keepUnits: '1' }))).toEqual({
      level: 'ITEM',
      store: null,
      item: '121007',
      category: null,
      keepUnits: 1,
      keepDays: null,
      firstDay: '2026-11-27',
      lastDay: null,
    })
    expect(overrideValues(form({ level: 'CATEGORY', category: 'MC0312', keepDays: '1' }))).toMatchObject({ store: null, item: null, category: 'MC0312' })
    expect(overrideProblems(form({ level: 'CATEGORY', keepDays: '1' }))).toEqual(['needCategory'])
  })

  it('trims an item code typed with spaces', () => {
    expect(overrideValues(form({ level: 'ITEM', item: ' 121007 ', keepUnits: '1' }))).toMatchObject({ item: '121007' })
  })

  it('needs a first day, and a last day not before it', () => {
    expect(overrideProblems(form({ keepUnits: '1', firstDay: '' }))).toEqual(['needFirstDay'])
    expect(overrideProblems(form({ keepUnits: '1', firstDay: '2026-12-10', lastDay: '2026-12-01' }))).toEqual(['lastBeforeFirst'])
    expect(overrideProblems(form({ keepUnits: '1', firstDay: '2026-12-10', lastDay: '2026-12-10' }))).toEqual([])
  })

  it('refuses a last day before today, given today (the server: "on or after the first day and today")', () => {
    expect(overrideProblems(form({ keepUnits: '1', firstDay: '2026-11-01', lastDay: '2026-11-26' }), '2026-11-27')).toEqual(['lastPast'])
    expect(overrideProblems(form({ keepUnits: '1', firstDay: '2026-11-01', lastDay: '2026-11-27' }), '2026-11-27')).toEqual([])
  })

  it('reads a row back into the form, figures as text', () => {
    const f = overrideFormOf({ level: 'CATEGORY', store: null, item: null, category: 'MC0312', keepUnits: 3, keepDays: 1, firstDay: '2026-11-01', lastDay: null })
    expect(f).toEqual({ level: 'CATEGORY', store: '', item: '', category: 'MC0312', keepUnits: '3', keepDays: '1', firstDay: '2026-11-01', lastDay: '' })
  })
})

describe('the level that will apply', () => {
  it('names the levels each level wins over: the more specific wins', () => {
    expect(levelsBeaten('STORE_ITEM')).toEqual(['ITEM', 'CATEGORY', 'STORE'])
    expect(levelsBeaten('CATEGORY')).toEqual(['STORE'])
    expect(levelsBeaten('STORE')).toEqual([])
  })

  const rows = [
    row('si', { level: 'STORE_ITEM', store: 'P905', item: '121007', keepUnits: 4 }),
    row('it', { level: 'ITEM', item: '121007', keepDays: 2 }),
    row('ca', { level: 'CATEGORY', category: 'MC0140', keepUnits: 3 }),
    row('st', { level: 'STORE', store: 'P907', keepDays: 1 }),
  ]

  it('applies the store-and-item row over every other level that also matches', () => {
    expect(overrideThatApplies(rows, { store: 'P905', item: '121007', category: 'MC0140' }, '2026-11-27')?.id).toBe('si')
  })

  it('falls to the item row at another store, then the category, then the store', () => {
    expect(overrideThatApplies(rows, { store: 'P901', item: '121007', category: 'MC0140' }, '2026-11-27')?.id).toBe('it')
    expect(overrideThatApplies(rows, { store: 'P901', item: '999999', category: 'MC0140' }, '2026-11-27')?.id).toBe('ca')
    expect(overrideThatApplies(rows, { store: 'P907', item: '999999', category: 'MC0901' }, '2026-11-27')?.id).toBe('st')
  })

  it('gives null where no row matches: the computed buffer stands', () => {
    expect(overrideThatApplies(rows, { store: 'P901', item: '999999', category: 'MC0901' }, '2026-11-27')).toBeNull()
  })

  it('skips a row that has ended, has not started, or is past its last day', () => {
    const dated = [
      row('ended', { level: 'STORE_ITEM', store: 'P905', item: '121007', keepUnits: 4 }, { endedAt: '2026-11-20 10:00:00' }),
      row('later', { level: 'ITEM', item: '121007', keepUnits: 4, firstDay: '2026-12-01' }),
      row('past', { level: 'CATEGORY', category: 'MC0140', keepUnits: 3, lastDay: '2026-11-26' }),
      row('last', { level: 'STORE', store: 'P905', keepUnits: 0, lastDay: '2026-11-27' }),
    ]
    expect(overrideThatApplies(dated, { store: 'P905', item: '121007', category: 'MC0140' }, '2026-11-27')?.id).toBe('last')
  })

  it('does not match a category row when the item\'s category is not given', () => {
    expect(overrideThatApplies(rows, { store: 'P901', item: '999999' }, '2026-11-27')).toBeNull()
  })
})
