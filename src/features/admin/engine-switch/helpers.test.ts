import { describe, expect, it } from 'vitest'
import type { StoreEngineRow } from '@/core/models/rule-campaign'
import { engineOf, filterStores, firstFlipStep, flipForm, flipTarget, inFlightCount, switchQueryFromParams, switchQueryToParams } from './helpers'

const row = (storeCode: string, storeName: string, engine: StoreEngineRow['engine']): StoreEngineRow => ({
  storeCode, storeName, engine, changedBy: null, changedAt: null, reason: null,
})

describe('flipForm', () => {
  it('requires a reason: none, or only spaces, is refused and nothing is sent', () => {
    expect(flipForm('R101', 'BonusBuy', 'Rule', '')).toEqual({ ok: false, error: 'reasonRequired' })
    expect(flipForm('R101', 'BonusBuy', 'Rule', '   \n ')).toEqual({ ok: false, error: 'reasonRequired' })
  })

  it('sends the store, the engine it was seen on, the engine it moves to and the reason trimmed', () => {
    expect(flipForm('R101', 'BonusBuy', 'Rule', '  Pilot wave 1 \n')).toEqual({
      ok: true,
      body: { storeCode: 'R101', from: 'BonusBuy', engine: 'Rule', reason: 'Pilot wave 1' },
    })
  })
})

describe('the engine', () => {
  it('reads a store HQ holds no row for as BonusBuy', () => {
    expect(engineOf(row('D310', 'Dammam', null))).toBe('BonusBuy')
    expect(engineOf(row('R101', 'Riyadh', 'Rule'))).toBe('Rule')
  })

  it('flips to the other engine', () => {
    expect(flipTarget('BonusBuy')).toBe('Rule')
    expect(flipTarget('Rule')).toBe('BonusBuy')
  })

  it('a flip back to bonus buys first shows what is in flight; a flip to the rule engine asks the reason', () => {
    expect(firstFlipStep('BonusBuy')).toBe('inFlight')
    expect(firstFlipStep('Rule')).toBe('reason')
  })

  it('counts what is in flight', () => {
    expect(inFlightCount({ liveCampaigns: [], openSessions: [], budgets: [] })).toBe(0)
    expect(inFlightCount({
      liveCampaigns: [{ code: 'A', name: { en: 'a', ar: 'ا' } }],
      openSessions: [{ saleId: 's', created: '2026-10-16T10:00:00' }, { saleId: 't', created: '2026-10-16T10:00:00' }],
      budgets: [{ campaignCode: 'A', budget: 'b' }],
    })).toBe(4)
  })
})

describe('the list', () => {
  const rows = [row('R101', 'Riyadh, Olaya', 'Rule'), row('D310', 'Dammam, Corniche', null), row('M01', 'Manama, Seef', 'BonusBuy')]

  it('searches the code or the name, any case', () => {
    expect(filterStores(rows, { search: 'olaya', engine: null, store: '' }).map((r) => r.storeCode)).toEqual(['R101'])
    expect(filterStores(rows, { search: ' m01 ', engine: null, store: '' }).map((r) => r.storeCode)).toEqual(['M01'])
  })

  it('filters by engine, a missing row reading BonusBuy', () => {
    expect(filterStores(rows, { search: '', engine: 'BonusBuy', store: '' }).map((r) => r.storeCode)).toEqual(['D310', 'M01'])
    expect(filterStores(rows, { search: '', engine: 'Rule', store: '' }).map((r) => r.storeCode)).toEqual(['R101'])
  })

  it('keeps the search, the engine and the store opened in the address, and round-trips', () => {
    const q = { search: 'riy', engine: 'Rule' as const, store: 'R101' }
    expect(switchQueryToParams(q).toString()).toBe('search=riy&engine=Rule&store=R101')
    expect(switchQueryFromParams(switchQueryToParams(q))).toEqual(q)
    expect(switchQueryFromParams(new URLSearchParams('engine=Legacy'))).toEqual({ search: '', engine: null, store: '' })
    expect(switchQueryToParams({ search: '', engine: null, store: '' }).toString()).toBe('')
  })
})
