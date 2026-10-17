/**
 * Ticket 510 — budgets read as sentences ("Limit the discount money to SAR 50,000.00 per campaign"),
 * and a live budget's used / limit shows an overshoot only once the counter is past its limit
 * (ADR 0091: a counter may pass its limit, and the overshoot is shown, never hidden).
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import type { RuleBudgetLimit, RuleBudgetPeriod, RuleBudgetScope } from '@/core/models/rule-campaign'
import { BUDGET_LIMITS, BUDGET_PERIODS, BUDGET_SCOPES, budgetAmount, budgetFigure, budgetSentence, budgetUsage } from './budget'
import { plainSentence } from './sentence'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'campaign-workspace': en } },
  ns: ['campaign-workspace'],
  defaultNS: 'campaign-workspace',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const t = instance.getFixedT('en', 'campaign-workspace') as unknown as (key: string, o: Record<string, unknown>) => string
const read = (scope: RuleBudgetScope, limit: RuleBudgetLimit, value: number, period: RuleBudgetPeriod, currency: string | null = 'SAR') =>
  plainSentence(budgetSentence({ scope, limit, value, period }, currency), t)

describe('budgetSentence_readsEveryScopeAndPeriod', () => {
  it('reads the ticket’s two sentences', () => {
    expect(read('campaign', 'money', 50000, 'lifetime')).toBe('Limit the discount money to SAR 50,000.00 per campaign')
    expect(read('profile', 'uses', 1, 'month')).toBe('Limit the uses to 1 per member per month')
  })

  it('names every scope', () => {
    expect(BUDGET_SCOPES.map((s) => read(s, 'uses', 2, 'lifetime'))).toEqual([
      'Limit the uses to 2 per campaign',
      'Limit the uses to 2 per member',
      'Limit the uses to 2 per coupon code',
      'Limit the uses to 2 per store',
      'Limit the uses to 2 per sale',
    ])
  })

  it('names every period; lifetime adds none, and there is no year (2758)', () => {
    expect(BUDGET_PERIODS.map((p) => read('store', 'uses', 3, p))).toEqual([
      'Limit the uses to 3 per store',
      'Limit the uses to 3 per store per day',
      'Limit the uses to 3 per store per week',
      'Limit the uses to 3 per store per month',
    ])
  })

  it('names every limit; money and points are amounts in the campaign’s currency, uses a count', () => {
    expect(BUDGET_LIMITS.map((l) => read('campaign', l, 30, 'lifetime'))).toEqual([
      'Limit the discount money to SAR 30.00 per campaign',
      'Limit the uses to 30 per campaign',
      'Limit the points given to SAR 30.00 per campaign',
      'Limit the points taken to SAR 30.00 per campaign',
    ])
  })

  it('BHD has three decimals; an unknown currency shows its own decimals with no code', () => {
    expect(read('campaign', 'money', 1250.5, 'lifetime', 'BHD')).toBe('Limit the discount money to BHD 1,250.500 per campaign')
    expect(read('campaign', 'money', 1250.5, 'lifetime', null)).toBe('Limit the discount money to 1,250.50 per campaign')
  })

  it('every key it uses exists in the bundle', () => {
    for (const scope of BUDGET_SCOPES)
      for (const limit of BUDGET_LIMITS)
        for (const period of BUDGET_PERIODS) {
          const s = budgetSentence({ scope, limit, value: 1, period }, 'SAR')
          expect(instance.exists(s.key)).toBe(true)
          for (const v of Object.values(s.values)) if (v.kind === 'phrase') expect(instance.exists(v.sentence.key)).toBe(true)
        }
  })
})

describe('budgetUsage_showsOvershootOnlyPastTheLimit', () => {
  it('under the limit: no overshoot, the bar part-filled', () => {
    expect(budgetUsage(12345.5, 50000)).toEqual({ used: 12345.5, limit: 50000, overshoot: null, share: 0.24691, usedUp: false })
  })

  it('exactly at the limit is used up, not over', () => {
    expect(budgetUsage(2, 2)).toEqual({ used: 2, limit: 2, overshoot: null, share: 1, usedUp: true })
  })

  it('past the limit: the overshoot is what went past, the bar full', () => {
    expect(budgetUsage(3, 2)).toEqual({ used: 3, limit: 2, overshoot: 1, share: 1, usedUp: true })
  })

  it('an overshoot of money is rounded to the fils, not left as float noise', () => {
    expect(budgetUsage(50000.1, 50000).overshoot).toBe(0.1)
    expect(budgetUsage(10.0005, 10).overshoot).toBe(0.001)
  })

  it('nothing used yet', () => {
    expect(budgetUsage(0, 10)).toEqual({ used: 0, limit: 10, overshoot: null, share: 0, usedUp: false })
  })
})

describe('budgetAmount', () => {
  it('money and points are money in the currency; uses are a number', () => {
    expect(budgetAmount('money', 5, 'BHD')).toEqual({ kind: 'money', amount: 5, currency: 'BHD' })
    expect(budgetAmount('pointsTaken', 5, 'SAR')).toEqual({ kind: 'money', amount: 5, currency: 'SAR' })
    expect(budgetAmount('uses', 5, 'SAR')).toEqual({ kind: 'number', n: 5 })
  })

  it('a figure as one string: money in the currency’s decimals, uses as the app writes a number', () => {
    expect(budgetFigure('money', 12345.5, 'SAR')).toBe('SAR 12,345.50')
    expect(budgetFigure('pointsGiven', 0.1, 'BHD')).toBe('BHD 0.100')
    expect(budgetFigure('uses', 1200, 'SAR')).toBe('1200')
  })
})
