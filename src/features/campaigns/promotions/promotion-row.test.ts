import { describe, expect, it } from 'vitest'
import type { RulePromotionSummary } from '@/core/models/rule-promotion'
import { promotionBadge, promotionKind, promotionRowView } from './promotion-row'

const promotion = (over: Partial<RulePromotionSummary> = {}): RulePromotionSummary => ({
  promotionCode: '0001000048-261009-261015',
  nameEn: 'Sunscreen offers',
  nameAr: 'أسبوع واقي الشمس',
  origin: 'upload',
  note: '',
  campaignCount: 3,
  skuCount: 41,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  state: 'live',
  liveVersionNo: 42,
  revision: 3,
  uploadState: 'activated',
  uploadedBy: 'author1',
  uploadNote: 'SAP promotion number 0001000048',
  approvedBy: 'approver1',
  createdAt: '2026-10-08T09:00:00',
  ...over,
})

/** The no-promotion row as HQ sends it: last, `promotionCode: null, origin: null`, names and note "". */
const noPromotion = (over: Partial<RulePromotionSummary> = {}) =>
  promotion({ promotionCode: null, origin: null, nameEn: '', nameAr: '', note: '', state: 'disabled', liveVersionNo: null, revision: null, uploadState: null, uploadedBy: null, uploadNote: null, approvedBy: null, ...over })

describe('promotionBadge', () => {
  it('gives each of the four states its own badge', () => {
    for (const s of ['live', 'pending', 'ended', 'disabled']) expect(promotionBadge(s)).toBe(s)
  })

  it('renders a state HQ adds later as disabled', () => {
    expect(promotionBadge('archived')).toBe('disabled')
    expect(promotionBadge('')).toBe('disabled')
    expect(promotionRowView(promotion({ state: 'Live' })).badge).toBe('disabled')
  })
})

describe('promotionKind', () => {
  it('reads Uploaded from upload and Hand-made from manual', () => {
    expect(promotionKind('upload')).toBe('uploaded')
    expect(promotionKind('manual')).toBe('handMade')
  })

  it('gives no kind to a null or unlisted origin', () => {
    expect(promotionKind(null)).toBeNull()
    expect(promotionKind('imported')).toBeNull()
  })
})

describe('promotionRowView', () => {
  it('a promotion opens its own page, its code and both names shown', () => {
    const v = promotionRowView(promotion())
    expect(v).toMatchObject({
      noPromotion: false,
      promotionCode: '0001000048-261009-261015',
      nameEn: 'Sunscreen offers',
      nameAr: 'أسبوع واقي الشمس',
      named: true,
      kind: 'uploaded',
      badge: 'live',
      path: '/campaigns/promotions/0001000048-261009-261015',
    })
  })

  it('a code with a character a path cannot carry raw is escaped in its link', () => {
    expect(promotionRowView(promotion({ promotionCode: 'A B' })).path).toBe('/campaigns/promotions/A%20B')
  })

  it('the no-promotion row is told by promotionCode null: "No promotion", /campaigns/no-promotion, no kind', () => {
    const v = promotionRowView(noPromotion())
    expect(v).toMatchObject({ noPromotion: true, promotionCode: null, kind: null, path: '/campaigns/no-promotion', upload: null })
  })

  it('is never told by origin: a hand-made origin with a null code is still the no-promotion row', () => {
    expect(promotionRowView(noPromotion({ origin: 'manual' })).noPromotion).toBe(true)
  })

  it('a stray code (neither a record nor an upload) comes with origin null: its own row, no kind', () => {
    const v = promotionRowView(promotion({ promotionCode: 'OLD-FLYER', origin: null, nameEn: '', nameAr: '', revision: null, uploadState: null }))
    expect(v).toMatchObject({ noPromotion: false, kind: null, path: '/campaigns/promotions/OLD-FLYER' })
  })

  it('empty names show the code alone', () => {
    const v = promotionRowView(promotion({ nameEn: '', nameAr: '  ' }))
    expect(v).toMatchObject({ named: false, nameEn: '', nameAr: '' })
    expect(promotionRowView(promotion({ nameEn: '', nameAr: 'عرض' }))).toMatchObject({ named: true, nameEn: '', nameAr: 'عرض' })
  })

  it('shows the live version only when live', () => {
    expect(promotionRowView(promotion()).liveVersionNo).toBe(42)
    expect(promotionRowView(promotion({ state: 'ended', liveVersionNo: 42 })).liveVersionNo).toBeNull()
    expect(promotionRowView(promotion({ state: 'live', liveVersionNo: null })).liveVersionNo).toBeNull()
    expect(promotionRowView(promotion({ state: 'live', liveVersionNo: 0 })).liveVersionNo).toBe(0)
  })

  it('carries the upload facts for a promotion with an upload, none without', () => {
    expect(promotionRowView(promotion()).upload).toEqual({ revision: 3, uploadState: 'activated', uploadedBy: 'author1', approvedBy: 'approver1' })
    expect(promotionRowView(promotion({ revision: 2, uploadState: 'pending', approvedBy: null })).upload).toEqual({ revision: 2, uploadState: 'pending', uploadedBy: 'author1', approvedBy: '' })
    const hand = promotion({ origin: 'manual', revision: null, uploadState: null, uploadedBy: null, uploadNote: null, approvedBy: null })
    expect(promotionRowView(hand)).toMatchObject({ kind: 'handMade', upload: null })
  })
})

describe('the window (windowDays)', () => {
  it("shows a promotion's windowUntil as sent: the inclusive last day", () => {
    expect(promotionRowView(promotion()).window).toBe('2026-10-09 – 2026-10-15')
    expect(promotionRowView(noPromotion({ windowFrom: '2026-09-01T00:00:00', windowUntil: '2026-12-31T00:00:00' })).window).toBe('2026-09-01 – 2026-12-31')
  })

  it('a null window shows none', () => {
    expect(promotionRowView(promotion({ windowFrom: null, windowUntil: null })).window).toBeNull()
    expect(promotionRowView(noPromotion({ windowFrom: null, windowUntil: null })).window).toBeNull()
  })
})
