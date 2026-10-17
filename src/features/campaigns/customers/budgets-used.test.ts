/**
 * Ticket 519 — a member's budgets used: each profile-scope budget reads its counter against its
 * limit in the budget's own figures (a count, or money in the campaign's currency), in its period,
 * and a counter past its limit shows how far (ADR 0091: never clamped away).
 */
import { describe, expect, it } from 'vitest'
import type { RuleMemberBudget } from '@/core/models/rule-campaign'
import { profileBudgetRows } from './budgets-used'

const B = (o: Partial<RuleMemberBudget>): RuleMemberBudget => ({
  campaignId: 'GP-BEAUTY15',
  campaignCode: 'GP-BEAUTY15',
  campaignName: { en: 'Gold & Platinum: 15% off Beauty', ar: 'الذهبي والبلاتيني: خصم 15% على التجميل' },
  budgetId: 'b1',
  name: 'twice a month per member',
  limit: 'uses',
  value: 2,
  period: 'month',
  used: 1,
  currency: 'SAR',
  ...o,
})

describe('profileBudgets_rowsShowUsedOfLimitPerPeriod', () => {
  it('reads used of limit as one string, with its period', () => {
    const [row] = profileBudgetRows([B({})])
    expect(row).toMatchObject({ usedOfLimit: '1 / 2', period: 'month', usedUp: false, overshoot: null, share: 0.5 })
    expect(row.key).toBe('GP-BEAUTY15/b1')
    expect(row.name).toBe('twice a month per member')
    expect(row.campaignName.ar).toBe('الذهبي والبلاتيني: خصم 15% على التجميل')
  })

  it('keeps each budget’s own period, a lifetime one included, in HQ’s order', () => {
    const rows = profileBudgetRows([
      B({ budgetId: 'y', period: 'year', value: 1, used: 0 }),
      B({ budgetId: 'l', period: 'lifetime', value: 1, used: 1 }),
      B({ budgetId: 'd', period: 'day', value: 3, used: 2 }),
    ])
    expect(rows.map((r) => [r.period, r.usedOfLimit])).toEqual([
      ['year', '0 / 1'],
      ['lifetime', '1 / 1'],
      ['day', '2 / 3'],
    ])
  })

  it('a money or points limit reads in the campaign’s currency — BHD at three decimals', () => {
    expect(profileBudgetRows([B({ limit: 'money', value: 100, used: 40 })])[0].usedOfLimit).toBe('SAR 40.00 / SAR 100.00')
    expect(profileBudgetRows([B({ limit: 'pointsGiven', value: 5, used: 1.25, currency: 'BHD' })])[0].usedOfLimit).toBe('BHD 1.250 / BHD 5.000')
  })

  it('a counter at its limit is used up, not over', () => {
    expect(profileBudgetRows([B({ used: 2 })])[0]).toMatchObject({ usedUp: true, overshoot: null, share: 1 })
  })

  it('a counter past its limit shows the overshoot in the same figure', () => {
    expect(profileBudgetRows([B({ used: 3 })])[0]).toMatchObject({ usedUp: true, overshoot: '1', share: 1 })
    expect(profileBudgetRows([B({ limit: 'money', value: 100, used: 112.5 })])[0].overshoot).toBe('SAR 12.50')
  })

  it('a money counter a float hair under its limit reads used up, as its figures do', () => {
    expect(profileBudgetRows([B({ limit: 'money', value: 100, used: 99.99999999 })])[0]).toMatchObject({ usedOfLimit: 'SAR 100.00 / SAR 100.00', usedUp: true, overshoot: null })
  })

  it('nothing used yet reads 0 of the limit', () => {
    expect(profileBudgetRows([B({ used: 0 })])[0]).toMatchObject({ usedOfLimit: '0 / 2', usedUp: false, share: 0 })
  })

  it('no budgets, no rows', () => {
    expect(profileBudgetRows([])).toEqual([])
  })
})
