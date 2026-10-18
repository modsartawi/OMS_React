import { describe, expect, it } from 'vitest'
import type { RuleCampaignBudget, RuleCouponBatchSummary } from '@/core/models/rule-campaign'
import {
  batchTotals,
  budgetsToAdd,
  couponCreateBody,
  couponCreateProblems,
  couponImportBody,
  emptyCouponForm,
  limitsCovered,
  memberIds,
  suggestedTemplate,
  unusedOf,
  visibleBatches,
  type CouponCreateForm,
} from './coupon-form'

const form = (o: Partial<CouponCreateForm> = {}): CouponCreateForm => ({ ...emptyCouponForm('TPL-WKND20'), ...o })

const budget = (id: string, scope: RuleCampaignBudget['scope'], limit: RuleCampaignBudget['limit'] = 'uses'): RuleCampaignBudget => ({
  id,
  name: { en: id, ar: id },
  scope,
  limit,
  value: 1,
  period: 'lifetime',
})

const batch = (batchId: string, o: Partial<RuleCouponBatchSummary> = {}): RuleCouponBatchSummary => ({
  batchId,
  templateId: 'TPL-WKND20',
  campaign: 'WKND20',
  codes: 5,
  used: 1,
  disabled: 1,
  createdAt: '2026-09-28T11:30:00',
  createdBy: 'Sara (CRM)',
  ...o,
})

describe('couponForm', () => {
  it('couponForm_buildsCreateBody', () => {
    // random: the template, the count, the days as typed (never a `Z`), the ticked limits.
    expect(couponCreateBody(form({ count: ' 250 ', from: '2026-11-01', until: '2026-11-30', code: 'IGNORED', members: 'M-1', eachCodeOnce: true, oncePerCustomer: true }))).toEqual({
      templateId: 'TPL-WKND20',
      kind: 'random',
      eachCodeOnce: true,
      oncePerCustomer: true,
      count: 250,
      validFrom: '2026-11-01',
      validTo: '2026-11-30',
    })
    // universal: the code upper-cased; blank = HQ generates it with the template's prefix. "Each
    // code once" is never sent for one code anyone uses.
    expect(couponCreateBody(form({ kind: 'universal', code: ' hayak15 ', eachCodeOnce: true }))).toEqual({
      templateId: 'TPL-WKND20',
      kind: 'universal',
      eachCodeOnce: false,
      oncePerCustomer: false,
      code: 'HAYAK15',
    })
    expect(couponCreateBody(form({ kind: 'universal', code: '' }))).toEqual({ templateId: 'TPL-WKND20', kind: 'universal', eachCodeOnce: false, oncePerCustomer: false })
    // personal: each member id once, as typed.
    expect(couponCreateBody(form({ kind: 'personal', members: 'M-100231, m-055410\nM-100231\n', count: '0', oncePerCustomer: true }))).toEqual({
      templateId: 'TPL-WKND20',
      kind: 'personal',
      eachCodeOnce: false,
      oncePerCustomer: true,
      members: ['M-100231', 'm-055410'],
    })
    // import: the same door, the rows as `code[,customerId]` lines, no limit box.
    expect(couponImportBody(' TPL-WKND20 ', 'WKND-1\nWKND-2,M-1')).toEqual({ templateId: 'TPL-WKND20', kind: 'import', csv: 'WKND-1\nWKND-2,M-1', eachCodeOnce: false, oncePerCustomer: false })

    // A limit a budget already does is not sent again.
    const covered = limitsCovered([budget('b-each', 'coupon'), budget('b-money', 'profile', 'money')])
    expect(covered).toEqual({ eachCodeOnce: true, oncePerCustomer: false })
    expect(couponCreateBody(form({ eachCodeOnce: true, oncePerCustomer: true }), covered)).toMatchObject({ eachCodeOnce: false, oncePerCustomer: true })
    // A looser budget is not "once": 100 uses a code, or once a month a member.
    expect(limitsCovered([{ ...budget('b-100', 'coupon'), value: 100 }, { ...budget('b-month', 'profile'), period: 'month' }])).toEqual({ eachCodeOnce: false, oncePerCustomer: false })
  })

  it('validates each kind at its field, and the template for every kind', () => {
    expect(couponCreateProblems(form({ templateId: ' ' }))).toEqual({ templateId: 'templateRequired' })
    expect(couponCreateProblems(form({ templateId: 'T'.repeat(27) }))).toEqual({ templateId: 'templateLong' })
    // random: 1 to 10,000 (HQ's MaxCoupons).
    expect(couponCreateProblems(form({ count: '0' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ count: '10001' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ count: '12.5' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ count: '10000' }))).toEqual({})
    // universal: blank or HQ's code (letters, digits, - _ ., a letter or digit first, at most 64).
    const universal = form({ kind: 'universal', count: '0' })
    expect(couponCreateProblems({ ...universal, code: '' })).toEqual({})
    expect(couponCreateProblems({ ...universal, code: '-AB' })).toEqual({ code: 'codeShape' })
    expect(couponCreateProblems({ ...universal, code: 'AB+1' })).toEqual({ code: 'codeShape' })
    expect(couponCreateProblems({ ...universal, code: 'A'.repeat(65) })).toEqual({ code: 'codeShape' })
    expect(couponCreateProblems({ ...universal, code: 'hayak_15.x' })).toEqual({})
    // personal: at least one id, at most 10,000, each one HQ takes.
    const personal = form({ kind: 'personal', count: '0' })
    expect(couponCreateProblems({ ...personal, members: ' \n ' })).toEqual({ members: 'membersEmpty' })
    expect(couponCreateProblems({ ...personal, members: 'M-1\nM+2' })).toEqual({ members: 'membersShape' })
    expect(couponCreateProblems({ ...personal, members: 'M'.repeat(27) })).toEqual({ members: 'membersShape' })
    expect(couponCreateProblems({ ...personal, members: Array.from({ length: 10001 }, (_, i) => `M-${i}`).join(' ') })).toEqual({ members: 'membersRange' })
    // validity: local days, the last (inclusive) not before the first.
    expect(couponCreateProblems(form({ from: '2026-11-01', until: '2026-11-01' }))).toEqual({})
    expect(couponCreateProblems(form({ from: '2026-11-01', until: '2026-10-31' }))).toEqual({ until: 'untilBeforeFrom' })
    expect(couponCreateProblems(form({ from: '1/11/2026' }))).toEqual({ from: 'dayShape' })
    expect(couponCreateBody(form({ count: '0' }))).toBeNull()
  })

  it('counts member ids once in any case, as first typed (as HQ does)', () => {
    expect(memberIds('M-1, m-2;M-1|M-3\tM-2\r\n')).toEqual({ ids: ['M-1', 'm-2', 'M-3'], repeated: 2 })
  })

  it('adds only the answered budgets the campaign does not have', () => {
    const each = budget('b-each-code-once', 'coupon')
    const once = budget('b-once-per-customer', 'profile')
    expect(budgetsToAdd([each], [each, once])).toEqual([once])
    expect(budgetsToAdd(undefined, [each])).toEqual([each])
    expect(budgetsToAdd([each, once], [each, once])).toEqual([])
  })

  it('reads the batch list: the suggested template, the search, the totals and the unused', () => {
    const list = [batch('01JB7N2W8Q', { templateId: 'TPL-B' }), batch('01HZX4K9PE')]
    expect(suggestedTemplate(list)).toBe('TPL-B')
    expect(suggestedTemplate([])).toBe('')
    expect(suggestedTemplate(undefined)).toBe('')
    expect(visibleBatches(list, ' hzx ').map((b) => b.batchId)).toEqual(['01HZX4K9PE'])
    expect(visibleBatches(list, 'tpl-b').map((b) => b.batchId)).toEqual(['01JB7N2W8Q'])
    expect(visibleBatches(list, '')).toHaveLength(2)
    expect(batchTotals(list)).toEqual({ batches: 2, codes: 10, used: 2, disabled: 2 })
    expect(unusedOf({ codes: 5, used: 2 })).toBe(3)
    expect(unusedOf({ codes: 1, used: 1 })).toBe(0)
  })
})
