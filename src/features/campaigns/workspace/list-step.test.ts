import { describe, expect, it } from 'vitest'
import type { RulePromotionCampaignPage, RulePromotionCampaignRow } from '@/core/models/rule-promotion'
import type { PromotionListContext } from '@/core/rules/promotion-query'
import { campaignLookupBody, isUploadedCampaign, neighbourId, neighbours, promotionOfLookup, stepPath } from './list-step'

const row = (id: string, extra: Partial<RulePromotionCampaignRow> = {}): RulePromotionCampaignRow => ({
  id,
  nameEn: id,
  nameAr: '',
  nameArGenerated: false,
  mechanic: 'bundle',
  skuCount: 1,
  ruleCount: 1,
  windowFrom: null,
  windowUntil: null,
  status: 'Published',
  ...extra,
})

const pageOf = (page: number, ids: string[], total: number, pageSize = 3): RulePromotionCampaignPage => ({
  promotionCode: 'FLYER',
  total,
  page,
  pageSize,
  mechanics: {},
  generatedNames: 0,
  campaigns: ids.map((id) => row(id)),
})

describe('neighbours', () => {
  // 7 campaigns, 3 a page: [A B C] [D E F] [G]
  const middle = pageOf(2, ['D', 'E', 'F'], 7)

  it('within a page, Prev and Next are the rows beside it', () => {
    expect(neighbours('E', middle)).toEqual({ prev: { id: 'D', page: 2 }, next: { id: 'F', page: 2 } })
  })

  it('at a page’s last row Next asks for the next page’s first, at its first Prev for the previous page’s last', () => {
    expect(neighbours('F', middle)?.next).toEqual({ page: 3, take: 'first' })
    expect(neighbours('D', middle)?.prev).toEqual({ page: 1, take: 'last' })
  })

  it('at the list’s ends the step is disabled', () => {
    expect(neighbours('A', pageOf(1, ['A', 'B', 'C'], 7))?.prev).toBeNull()
    expect(neighbours('G', pageOf(3, ['G'], 7))?.next).toBeNull()
    expect(neighbours('C', pageOf(1, ['A', 'B', 'C'], 3))?.next).toBeNull()
    expect(neighbours('A', pageOf(1, ['A'], 1))).toEqual({ prev: null, next: null })
  })

  it('no context, no page yet, or a campaign not on its page (moved, refiltered) → none', () => {
    expect(neighbours('E', null)).toBeNull()
    expect(neighbours('E', undefined)).toBeNull()
    expect(neighbours('Z', middle)).toBeNull()
  })

  it('the neighbouring page answers the step: its first or its last row, none when it came back empty', () => {
    expect(neighbourId({ page: 3, take: 'first' }, pageOf(3, ['G'], 7))).toBe('G')
    expect(neighbourId({ page: 1, take: 'last' }, pageOf(1, ['A', 'B', 'C'], 7))).toBe('C')
    expect(neighbourId({ page: 3, take: 'first' }, pageOf(3, [], 6))).toBeNull()
    expect(neighbourId({ page: 3, take: 'first' }, undefined)).toBeNull()
    expect(neighbourId({ id: 'D', page: 2 }, undefined)).toBe('D')
  })
})

describe('stepPath', () => {
  const ctx: PromotionListContext = { promotionCode: 'FLYER', query: { q: 'sun', mechanic: '', status: '', page: 2 } }

  it('opens the neighbour on the same workspace page, the context at the neighbour’s page', () => {
    expect(stepPath('FLYER-07', '/rules', ctx, 3)).toBe('/campaigns/FLYER-07/rules?promotion=FLYER&q=sun&page=3')
    expect(stepPath('FLYER-04', '', ctx, 1)).toBe('/campaigns/FLYER-04?promotion=FLYER&q=sun')
  })
})

describe('isUploadedCampaign', () => {
  const upload = { promotionCode: '0001000048-261009-261015', origin: 'upload' }

  it('an uploaded promotion and the `<promotionCode>-` prefix, in any case → true', () => {
    expect(isUploadedCampaign('0001000048-261009-261015-SUN-3FOR2', upload)).toBe(true)
    expect(isUploadedCampaign('flyer-1-sun', { promotionCode: 'FLYER-1', origin: 'upload' })).toBe(true)
  })

  it('a hand-made promotion, or a campaign without the prefix → false', () => {
    expect(isUploadedCampaign('FLYER-1-SUN', { promotionCode: 'FLYER-1', origin: 'manual' })).toBe(false)
    expect(isUploadedCampaign('WKND20', upload)).toBe(false)
    // The code alone is not the prefix: the dash belongs to it.
    expect(isUploadedCampaign('FLYER-10-SUN', { promotionCode: 'FLYER-1', origin: 'upload' })).toBe(false)
    expect(isUploadedCampaign('FLYER-1', { promotionCode: 'FLYER-1', origin: 'upload' })).toBe(false)
  })

  it('no promotion, a stray code (origin null) or none known → false', () => {
    expect(isUploadedCampaign('X-1', { promotionCode: null, origin: null })).toBe(false)
    expect(isUploadedCampaign('X-1', { promotionCode: 'X', origin: null })).toBe(false)
    expect(isUploadedCampaign('X-1', undefined)).toBe(false)
  })
})

describe('a direct link’s promotion (BO ask J, BackOffice 2855)', () => {
  it('asks every campaign matching the id, HQ’s largest page (q also matches part of other ids and names)', () => {
    expect(campaignLookupBody('WKND20')).toEqual({ promotionCode: null, all: true, q: 'WKND20', page: 1, pageSize: 200 })
  })

  it('takes the row whose id equals it exactly, and its promotionCode (null = no promotion)', () => {
    const page = { ...pageOf(1, [], 2), campaigns: [row('WKND20-B', { promotionCode: 'OTHER' }), row('WKND20', { promotionCode: 'FLYER' })] }
    expect(promotionOfLookup(page, 'WKND20')).toEqual({ promotionCode: 'FLYER' })
    const none = { ...pageOf(1, [], 1), campaigns: [row('WKND20', { promotionCode: null })] }
    expect(promotionOfLookup(none, 'WKND20')).toEqual({ promotionCode: null })
  })

  it('until ask J lands (no promotionCode on the row), or with no exact row, it is not known', () => {
    expect(promotionOfLookup(pageOf(1, ['WKND20'], 1), 'WKND20')).toBeNull()
    expect(promotionOfLookup({ ...pageOf(1, [], 1), campaigns: [row('wknd20', { promotionCode: 'FLYER' })] }, 'WKND20')).toBeNull()
    expect(promotionOfLookup(undefined, 'WKND20')).toBeNull()
  })
})
