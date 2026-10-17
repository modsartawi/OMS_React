import { describe, expect, it } from 'vitest'
import type { RuleEngineInFlight, StoreEngineChange, StoreEngineLookupItem } from '@/core/models/rule-campaign'
import {
  afterFlip,
  engineOf,
  filterByEngine,
  flipForm,
  flipTarget,
  inFlightCount,
  storeRows,
  wasAlreadyOn,
  switchQueryFromParams,
  switchQueryToParams,
} from './helpers'

// The real 2745 shapes: Rules/Switch/Flip's reply, and Rules/Authoring/Lookups/stores' answers.
const lookup = (code: string, en: string, detail: string | null): StoreEngineLookupItem => ({ code, name: { en, ar: '' }, detail })

const IN_FLIGHT: RuleEngineInFlight = {
  liveCampaigns: [{ code: 'WKND20', nameEn: 'Weekend coupon', nameAr: 'قسيمة نهاية الأسبوع' }],
  openSessions: [
    { sessionId: '01JA0', channel: 'callcenter', openedAt: '2026-10-16T17:55:00', paidAt: '2026-10-16T17:58:00' },
    { sessionId: '01JA1', channel: 'till', openedAt: '2026-10-16T18:01:00', paidAt: '2026-10-16T18:02:00' },
  ],
  storeBudgets: [{ campaignId: 'WKND20', budgetId: 'store-money', periodKey: '2026-10', used: 1250.5, held: 40 }],
  truncated: false,
}

const change = (over: Partial<StoreEngineChange>): StoreEngineChange => ({
  storeCode: 'R101',
  fromEngine: 'Rule',
  engine: 'BonusBuy',
  changedBy: 'msartawi',
  changedAt: '2026-10-16T18:30:00',
  reason: 'Till fault',
  inFlight: null,
  ...over,
})

describe('flipForm', () => {
  it('requires a reason: none, or only spaces, is refused and nothing is sent', () => {
    expect(flipForm('R101', 'Rule', '')).toEqual({ ok: false, error: 'reasonRequired' })
    expect(flipForm('R101', 'Rule', '   \n ')).toEqual({ ok: false, error: 'reasonRequired' })
  })

  it('sends the store, the engine it moves to and the reason trimmed — and no `from`', () => {
    expect(flipForm('R101', 'Rule', '  Pilot wave 1 \n')).toEqual({
      ok: true,
      body: { storeCode: 'R101', engine: 'Rule', reason: 'Pilot wave 1' },
    })
  })
})

describe('the engine', () => {
  it('reads only an exact Rule as the rule engine; a missing, empty or unknown value is BonusBuy', () => {
    expect(engineOf('Rule')).toBe('Rule')
    expect(engineOf('BonusBuy')).toBe('BonusBuy')
    expect(engineOf(null)).toBe('BonusBuy')
    expect(engineOf('')).toBe('BonusBuy')
    expect(engineOf('rule')).toBe('BonusBuy')
  })

  it('lists the stores lookup with the engine from `detail` and the English name', () => {
    expect(storeRows([lookup('R101', 'Riyadh, Olaya', 'Rule'), lookup('D310', 'Dammam', 'BonusBuy'), lookup('X1', 'X', null)])).toEqual([
      { storeCode: 'R101', storeName: 'Riyadh, Olaya', engine: 'Rule' },
      { storeCode: 'D310', storeName: 'Dammam', engine: 'BonusBuy' },
      { storeCode: 'X1', storeName: 'X', engine: 'BonusBuy' },
    ])
  })

  it('names a store by its English name, the Arabic only when it is all HQ holds', () => {
    expect(storeRows([{ code: 'K12', name: { en: '', ar: 'الخبر' }, detail: 'Rule' }])[0].storeName).toBe('الخبر')
  })

  it('flips to the other engine', () => {
    expect(flipTarget('BonusBuy')).toBe('Rule')
    expect(flipTarget('Rule')).toBe('BonusBuy')
  })
})

describe('in flight, on the flip reply', () => {
  it('counts what is in flight; a flip that warned of nothing has none', () => {
    expect(inFlightCount(null)).toBe(0)
    expect(inFlightCount({ liveCampaigns: [], openSessions: [], storeBudgets: [], truncated: false })).toBe(0)
    expect(inFlightCount(IN_FLIGHT)).toBe(4)
  })

  it('shows the in-flight list after a flip back that warned, and closes otherwise', () => {
    expect(afterFlip(change({ inFlight: IN_FLIGHT }))).toBe('inFlight')
    expect(afterFlip(change({ inFlight: null }))).toBe('done')
    expect(afterFlip(change({ fromEngine: 'BonusBuy', engine: 'Rule', inFlight: null }))).toBe('done')
    expect(afterFlip(change({ inFlight: { liveCampaigns: [], openSessions: [], storeBudgets: [], truncated: false } }))).toBe('done')
  })
})

describe('a stale list', () => {
  it('reads a reply from the engine it moved to as already flipped by someone else', () => {
    expect(wasAlreadyOn(change({ fromEngine: 'BonusBuy', engine: 'BonusBuy' }))).toBe(true)
    expect(wasAlreadyOn(change({}))).toBe(false)
  })
})

describe('the list', () => {
  const rows = storeRows([lookup('R101', 'Riyadh, Olaya', 'Rule'), lookup('D310', 'Dammam, Corniche', 'BonusBuy'), lookup('M01', 'Manama, Seef', 'Rule')])

  it('filters HQ’s answer by engine', () => {
    expect(filterByEngine(rows, 'BonusBuy').map((r) => r.storeCode)).toEqual(['D310'])
    expect(filterByEngine(rows, 'Rule').map((r) => r.storeCode)).toEqual(['R101', 'M01'])
    expect(filterByEngine(rows, null)).toBe(rows)
  })

  it('keeps the search, the engine and the store opened in the address, and round-trips', () => {
    const q = { search: 'riy', engine: 'Rule' as const, store: 'R101' }
    expect(switchQueryToParams(q).toString()).toBe('search=riy&engine=Rule&store=R101')
    expect(switchQueryFromParams(switchQueryToParams(q))).toEqual(q)
    expect(switchQueryFromParams(new URLSearchParams('engine=Legacy'))).toEqual({ search: '', engine: null, store: '' })
    expect(switchQueryToParams({ search: '', engine: null, store: '' }).toString()).toBe('')
  })
})
