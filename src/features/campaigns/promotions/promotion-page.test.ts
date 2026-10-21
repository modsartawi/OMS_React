import { describe, expect, it } from 'vitest'
import type { RulePromotionCampaignRow } from '@/core/models/rule-promotion'
import type { RuleDraftSummary } from '@/core/models/rule-campaign'
import { campaignRowView, mechanicChips, neverPublishedDrafts, pendingBeyond } from './promotion-page'

describe('mechanicChips', () => {
  it('every mechanics key becomes a chip with its count, after "All" with the sum', () => {
    expect(mechanicChips({ bundle: 120, percentOff: 400, builder: 3 })).toEqual([
      { mechanic: '', count: 523 },
      { mechanic: 'bundle', count: 120 },
      { mechanic: 'percentOff', count: 400 },
      { mechanic: 'builder', count: 3 },
    ])
  })

  it('builder and a mechanic this client has never heard of are chips too; a zero count is kept', () => {
    expect(mechanicChips({ builder: 2, spinTheWheel: 0 }).map((c) => c.mechanic)).toEqual(['', 'builder', 'spinTheWheel'])
  })

  it('the mechanic on in the URL stays a chip at 0 when HQ no longer counts it, so it can be cleared', () => {
    expect(mechanicChips({ bundle: 4 }, 'percentOff')).toEqual([
      { mechanic: '', count: 4 },
      { mechanic: 'bundle', count: 4 },
      { mechanic: 'percentOff', count: 0 },
    ])
    expect(mechanicChips({ bundle: 4 }, 'bundle')).toHaveLength(2)
  })

  it('no mechanic counted is "All" alone, at 0', () => {
    expect(mechanicChips({})).toEqual([{ mechanic: '', count: 0 }])
  })
})

const draft = (campaign: string, publishedVersionNo: number): RuleDraftSummary => ({
  campaign,
  name: { en: campaign, ar: '' },
  revision: 1,
  features: [],
  publishedVersionNo,
  updatedAt: '2026-10-16T09:40:00',
  updatedBy: 'Omar (marketing)',
  state: 'editing',
  requestedBy: '',
})

describe('neverPublishedDrafts', () => {
  it('a draft with publishedVersionNo > 0 is not listed; one with 0 is, in the order sent', () => {
    expect(neverPublishedDrafts([draft('A', 0), draft('WKND20', 3), draft('B', 0)]).map((d) => d.campaign)).toEqual(['A', 'B'])
  })
})

describe('pendingBeyond', () => {
  it('the unfiltered total past the promotion count is the pending re-upload’s new campaigns', () => {
    expect(pendingBeyond(560, 572)).toBe(12)
  })

  it('nothing pending when the total is not larger', () => {
    expect(pendingBeyond(560, 560)).toBe(0)
    expect(pendingBeyond(560, 540)).toBe(0)
  })
})

const row = (over: Partial<RulePromotionCampaignRow> = {}): RulePromotionCampaignRow => ({
  id: '0001000048-SUN-3FOR2',
  nameEn: 'Suncare 3 for 2',
  nameAr: 'العناية بالشمس 3 بسعر 2',
  nameArGenerated: false,
  mechanic: 'bundle',
  skuCount: 12,
  ruleCount: 1,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  status: 'Published',
  ...over,
})

describe('campaignRowView', () => {
  it('the window is the inclusive days sent, as one range', () => {
    expect(campaignRowView(row()).window).toBe('2026-10-09 – 2026-10-15')
    expect(campaignRowView(row({ windowFrom: null, windowUntil: null })).window).toBeNull()
  })

  it('a listed status is itself; an unknown one renders as Disabled', () => {
    expect(campaignRowView(row({ status: 'Pending' })).status).toBe('Pending')
    expect(campaignRowView(row({ status: 'Archived' })).status).toBe('Disabled')
  })

  it('a null mechanic (uploaded before 2846) is empty', () => {
    expect(campaignRowView(row({ mechanic: null })).mechanic).toBe('')
  })
})
