import { describe, expect, it } from 'vitest'
import type { RuleCampaignCoupon } from '@/core/models/rule-campaign'
import {
  codeExample,
  couponCounts,
  couponCreateBody,
  couponCreateProblems,
  emptyCouponForm,
  memberIds,
  statusFromParam,
  visibleCoupons,
  type CouponCreateForm,
} from './coupon-form'

const form = (o: Partial<CouponCreateForm> = {}): CouponCreateForm => ({ ...emptyCouponForm('WKND-20'), ...o })

/** Any key that would be a redemption limit on a code (ADR 0094: those are budgets). */
const LIMIT_KEY = /limit|once|max|uses|redemption|perMember|perCustomer/i

describe('couponCreate', () => {
  it('couponCreate_validatesEachKind_andCarriesNoLimitField', () => {
    // random: a count of 1 to 5,000, a length of 4 to 16 (the shortest digits still hold a batch).
    expect(couponCreateProblems(form({ count: '0' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ count: '5001' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ count: '12.5' }))).toEqual({ count: 'countRange' })
    expect(couponCreateProblems(form({ length: '3' }))).toEqual({ length: 'lengthRange' })
    expect(couponCreateProblems(form({ length: '17' }))).toEqual({ length: 'lengthRange' })
    expect(couponCreateProblems(form({ count: '5000', length: '4', charset: 'digits' }))).toEqual({})
    expect(couponCreateProblems(form({ count: '50', length: '4' }))).toEqual({})

    // universal: one code of 3 to 32 letters, digits or dashes, not one the campaign has.
    const universal = form({ kind: 'universal', count: '0', length: '1' })
    expect(couponCreateProblems({ ...universal, code: '' })).toEqual({ code: 'codeShape' })
    expect(couponCreateProblems({ ...universal, code: '-AB' })).toEqual({ code: 'codeShape' })
    expect(couponCreateProblems({ ...universal, code: 'hayak15' }, ['HAYAK15'])).toEqual({ code: 'codeTaken' })
    expect(couponCreateProblems({ ...universal, code: 'hayak-15' })).toEqual({})

    // personal: at least one member id, at most 5,000, with the random shape.
    const personal = form({ kind: 'personal', count: '0' })
    expect(couponCreateProblems({ ...personal, members: ' \n ' })).toEqual({ members: 'membersEmpty' })
    expect(couponCreateProblems({ ...personal, members: 'm-1\nM-2' })).toEqual({})
    expect(couponCreateProblems({ ...personal, members: 'M-1', length: '2' })).toEqual({ length: 'lengthRange' })
    expect(couponCreateProblems({ ...personal, members: Array.from({ length: 5001 }, (_, i) => `M-${i}`).join(' ') })).toEqual({ members: 'membersRange' })

    // validity, for every kind: local days, the last day (inclusive) not before the first.
    expect(couponCreateProblems(form({ from: '2026-11-01', until: '2026-11-01' }))).toEqual({})
    expect(couponCreateProblems(form({ from: '2026-11-01', until: '2026-10-31' }))).toEqual({ until: 'untilBeforeFrom' })
    expect(couponCreateProblems(form({ from: '2026-11-01', until: '2026-11-02' }))).toEqual({})
    expect(couponCreateProblems(form({ until: '2026-11-02' }))).toEqual({})
    expect(couponCreateProblems({ ...universal, code: 'HAYAK', from: '1/11/2026' })).toEqual({ from: 'dayShape' })

    // The bodies: only the kind's own fields, cleaned, the days as typed (never a `Z`).
    const random = couponCreateBody(form({ count: ' 250 ', prefix: 'wk-nd!', suffix: 'x1', length: '8', charset: 'letters', from: '2026-11-01', until: '2026-11-30', code: 'IGNORED', members: 'M-1' }))
    expect(random).toEqual({ kind: 'random', count: 250, prefix: 'WKND', suffix: 'X1', length: 8, charset: 'letters', from: '2026-11-01', until: '2026-11-30' })
    const uni = couponCreateBody({ ...universal, code: ' hayak15 ', members: 'M-1' })
    expect(uni).toEqual({ kind: 'universal', code: 'HAYAK15', from: null, until: null })
    const per = couponCreateBody({ ...personal, members: 'M-100231, m-055410\nM-100231\n' })
    expect(per).toEqual({ kind: 'personal', members: ['M-100231', 'm-055410'], prefix: 'WKND', suffix: '', length: 6, charset: 'lettersAndDigits', from: null, until: null })

    // No kind carries a redemption limit: those are coupon / profile budgets (ADR 0094).
    for (const body of [random, uni, per]) {
      expect(body).not.toBeNull()
      expect(Object.keys(body as object).filter((k) => LIMIT_KEY.test(k))).toEqual([])
    }
    expect(Object.keys(form()).filter((k) => LIMIT_KEY.test(k))).toEqual([])

    // A form with a problem sends nothing.
    expect(couponCreateBody(form({ count: '0' }))).toBeNull()
    expect(couponCreateBody({ ...universal, code: 'HAYAK15' }, ['HAYAK15'])).toBeNull()
  })

  it('a fresh form takes the campaign code’s first part as the prefix', () => {
    expect(emptyCouponForm('WKND20').prefix).toBe('WKND20')
    expect(emptyCouponForm('NEXT-VISIT').prefix).toBe('NEXT')
    expect(emptyCouponForm('ramadan-nights-2026').prefix).toBe('RAMADAN')
  })

  it('memberIds reads a pasted column or list, each id once, its case as typed', () => {
    expect(memberIds('M-1\r\nM-2;M-3 | M-1\t')).toEqual({ ids: ['M-1', 'M-2', 'M-3'], repeated: 1 })
    expect(memberIds('m-1 M-1')).toEqual({ ids: ['m-1', 'M-1'], repeated: 0 })
    expect(memberIds('')).toEqual({ ids: [], repeated: 0 })
  })

  it('codeExample shows the shape with its dashes', () => {
    expect(codeExample({ prefix: 'wknd', suffix: '', length: '6', charset: 'lettersAndDigits' })).toBe('WKND-K7Q2M9')
    expect(codeExample({ prefix: '', suffix: 'x', length: '4', charset: 'digits' })).toBe('4827-X')
    expect(codeExample({ prefix: 'A', suffix: '', length: 'nope', charset: 'letters' })).toBe('A-KQMX')
  })
})

const k = (code: string, status: RuleCampaignCoupon['status'], batch: string): RuleCampaignCoupon => ({
  code,
  status,
  batch,
  kind: 'random',
  uses: status === 'used' ? 1 : 0,
  member: null,
  created: '2026-10-01T09:00:00',
  from: null,
  until: null,
})

describe('the coupon list', () => {
  const codes = [k('WKND-4F7K2Q', 'unused', 'a1'), k('WKND-9XH3PL', 'used', 'a1'), k('WKND-T2M8VA', 'disabled', 'b2'), k('HAYAK15', 'expired', 'b2')]

  it('searches part of the code in any case, and filters by status and batch', () => {
    expect(visibleCoupons(codes, { q: 'wknd-9', status: 'all', batch: '' }).map((x) => x.code)).toEqual(['WKND-9XH3PL'])
    expect(visibleCoupons(codes, { q: '', status: 'expired', batch: '' }).map((x) => x.code)).toEqual(['HAYAK15'])
    expect(visibleCoupons(codes, { q: '', status: 'all', batch: 'b2' }).map((x) => x.code)).toEqual(['WKND-T2M8VA', 'HAYAK15'])
    expect(visibleCoupons(codes, { q: 'wknd', status: 'disabled', batch: 'a1' })).toEqual([])
    expect(visibleCoupons(codes, { q: '  ', status: 'all', batch: '' })).toHaveLength(4)
  })

  it('counts each status, and reads the status param', () => {
    expect(couponCounts(codes)).toEqual({ unused: 1, used: 1, disabled: 1, expired: 1 })
    expect(statusFromParam('expired')).toBe('expired')
    expect(statusFromParam('nonsense')).toBe('all')
    expect(statusFromParam(null)).toBe('all')
  })
})
