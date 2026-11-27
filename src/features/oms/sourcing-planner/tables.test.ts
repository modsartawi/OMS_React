/**
 * Ticket 968: the generic form reads the server's own checks first (BackOffice at pricing2 35a4e56be:
 * `PlannerStockService.SetConfidenceAsync`, `ProductRuleService.ChangeAsync`, `PlannerRowShapes.Check*`), so a refusal
 * from the door is rare. Each table's fields are its door's.
 */
import { describe, expect, it } from 'vitest'
import { formOf, formProblems, formValues, TABLES } from './tables'

const TODAY = '2026-11-27'
const keys = (table: Parameters<typeof formProblems>[0], form: Record<string, string | boolean>) => formProblems(table, { ...formOf(table, null, TODAY), ...form }, TODAY).map((p) => p.key)

describe('what each table\'s doors allow', () => {
  it('a rule is switched, never ended; a list entry is added or taken off, never changed; a planner table lists no ended row', () => {
    expect([TABLES.rules.endable, TABLES.restricted.changeable, TABLES.bulky.changeable, TABLES.storeModes.listsEnded]).toEqual([false, false, false, false])
    expect([TABLES.overrides.reasonKept, TABLES.confidence.reasonKept, TABLES.rules.reasonKept, TABLES.contracts.reasonKept]).toEqual([true, true, false, false])
  })
})

describe('a store\'s confidence', () => {
  it('runs 0.60 to 1.00 with two decimals at most, and ends from today to 90 days ahead', () => {
    expect(keys('confidence', { store: 'P907', confidence: '0.55' })).toEqual(['confidenceRange'])
    expect(keys('confidence', { store: 'P907', confidence: '0.755' })).toEqual(['confidenceDecimals'])
    expect(keys('confidence', { store: 'P907', endsOn: TODAY })).toEqual([])
    expect(keys('confidence', { store: 'P907', endsOn: '2026-11-26' })).toEqual(['endPast'])
    expect(keys('confidence', { store: 'P907', endsOn: '2027-02-26' })).toEqual(['endTooFar'])
  })
})

describe('a product rule', () => {
  it('names stores only as a "named stores" row, and a row naming no stores keeps the item off a mode', () => {
    expect(keys('rules', { value: 'BULKY' })).toEqual([])
    expect(keys('rules', { group: 'ITEM', value: '121007', reason: 'NAMED_STORES', mode: '' })).toEqual(['needStores', 'needModeOrStores'])
    expect(keys('rules', { value: 'BULKY', onlyFrom: 'P901' })).toEqual(['storesOnlyNamed'])
    expect(keys('rules', { group: 'COLD_CHAIN', value: '', reason: 'COLD' })).toEqual([])
    expect(keys('rules', { group: 'A_CLASS', value: '' })).toEqual(['needValue'])
  })

  it('sends the stores as a list of codes and a blank mode as none', () => {
    const v = formValues('rules', { ...formOf('rules', null, TODAY), group: 'ITEM', value: '121007', mode: '', reason: 'NAMED_STORES', onlyFrom: 'P901, P905' }, TODAY)
    expect(v).toMatchObject({ group: 'ITEM', value: '121007', mode: null, onlyFrom: ['P901', 'P905'], reason: 'NAMED_STORES', on: true })
  })
})

describe('the planner tables', () => {
  it('a store-by-mode row excludes a store from Dawaa Now or pick-up only', () => {
    expect(keys('storeModes', { store: 'P905', mode: 'DAWAA_NOW', gives: false })).toEqual([])
    expect(keys('storeModes', { store: 'P905', mode: 'SLOT', gives: false })).toEqual(['excludeOnlyOpen'])
  })

  it('a contract covers at least one city and delivers in 0 to 30 whole days', () => {
    expect(formProblems('contracts', { ...formOf('contracts', null, TODAY), contract: 'ARX-SD', rate: '18.5' }, TODAY)).toEqual([{ key: 'required', field: 'cities' }])
    expect(keys('contracts', { contract: 'ARX-SD', rate: '18.5', cities: '*', daysToDeliver: '31' })).toEqual(['badDaysToDeliver'])
    expect(formValues('contracts', { ...formOf('contracts', null, TODAY), contract: 'ARX-SD', cities: 'RUH, KHJ', rate: '18.5' }, TODAY)).toMatchObject({ cities: ['RUH', 'KHJ'], rate: 18.5 })
  })

  it('a slot ends after it starts; a next-day rule has no end', () => {
    expect(keys('slots', { from: '09:00', to: '12:00' })).toEqual([])
    expect(keys('slots', { from: '12:00', to: '09:00' })).toEqual(['toAfterFrom'])
    expect(keys('slots', { kind: 'NEXT_DAY_AFTER', from: '21:00', to: '' })).toEqual([])
    expect(keys('slots', { kind: 'NEXT_DAY_AFTER', from: '21:00', to: '23:00' })).toEqual(['nextDayNoEnd'])
  })
})
