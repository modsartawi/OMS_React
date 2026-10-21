import { describe, expect, it } from 'vitest'
import type { RuleCampaign, RuleDraftSummary, RuleOrder } from '@/core/models/rule-campaign'
import { CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { composePriorityCampaigns, featuresUsedBy } from './priority-campaigns'
import { campaignState } from '@/core/rules/campaign-state'

const says = (en: string, ar = '') => ({ en, ar })
const summary = (campaign: string, o: Partial<RuleDraftSummary> = {}): RuleDraftSummary => ({
  campaign,
  name: says(`${campaign} (draft)`),
  revision: 3,
  features: ['points'],
  publishedVersionNo: 0,
  updatedAt: '2026-10-16T09:40:00',
  updatedBy: 'Omar (marketing)',
  state: 'editing',
  requestedBy: '',
  ...o,
})
const live = (id: string, window: RuleCampaign['window']): RuleCampaign => ({ id, name: says(`${id} (live)`, 'حي'), window, rules: [] })
const ORDER: Pick<RuleOrder, 'campaigns'> = {
  campaigns: [
    { code: 'SUN-3FOR2', name: says('Suncare (order)'), group: 'g-items' },
    { code: 'WKND20', name: says('Weekend (order)'), group: null },
    { code: 'NATDAY-15', name: says('National Day (order)'), group: null },
  ],
}
const RULESET = {
  campaigns: [
    live('SUN-3FOR2', { from: '2026-08-01', until: '2026-11-01' }),
    live('WKND20', { from: '2026-09-01', until: '2026-10-01' }),
    live('NATDAY-15', { from: '2026-10-19', until: '2026-10-26' }),
  ],
}
const NOW = new Date(2026, 9, 16, 18, 30)

describe('priorityCampaigns_composesDraftsLiveAndWindows', () => {
  const rows = composePriorityCampaigns(
    [
      summary('SPRING-DRAFT'),
      summary('BDAY-BEAUTY', { state: 'pending', requestedBy: 'Omar (marketing)' }),
      summary('WKND20', { publishedVersionNo: 4, state: 'sentBack' }),
      summary('SUMMER-FLASH', { publishedVersionNo: 2 }),
    ],
    ORDER,
    RULESET,
  )
  const by = (code: string) => rows.find((r) => r.campaign === code)!

  it('lists every draft (last saved first) then every live campaign with no draft, each once', () => {
    expect(rows.map((r) => r.campaign)).toEqual(['SPRING-DRAFT', 'BDAY-BEAUTY', 'WKND20', 'SUMMER-FLASH', 'SUN-3FOR2', 'NATDAY-15'])
  })

  it('a draft never published is a draft; a pending one waits, whatever the live campaign does', () => {
    expect(by('SPRING-DRAFT')).toMatchObject({ state: 'editing', campaignStatus: '', window: null, live: null, features: ['points'] })
    expect(campaignState(by('SPRING-DRAFT'), NOW)).toBe('draft')
    expect(campaignState(by('BDAY-BEAUTY'), NOW)).toBe('waitingForApproval')
  })

  it('a draft over a live campaign takes the LIVE window and status, and the draft’s own name and stamp', () => {
    expect(by('WKND20')).toMatchObject({
      state: 'sentBack',
      campaignStatus: 'Published',
      window: { from: '2026-09-01', until: '2026-10-01' },
      name: says('WKND20 (draft)'),
      updatedBy: 'Omar (marketing)',
    })
    expect(campaignState(by('WKND20'), NOW)).toBe('expired')
  })

  it('a draft whose campaign was published once and is not in the live order is a disabled campaign', () => {
    expect(by('SUMMER-FLASH')).toMatchObject({ campaignStatus: 'Disabled', live: null, window: null })
    expect(campaignState(by('SUMMER-FLASH'), NOW)).toBe('disabled')
  })

  it('a live campaign with no draft is read from the live ruleset: its name, its window, no stamp', () => {
    expect(by('SUN-3FOR2')).toMatchObject({ state: null, campaignStatus: 'Published', name: says('SUN-3FOR2 (live)', 'حي'), features: null, updatedAt: '', updatedBy: '' })
    expect(by('SUN-3FOR2').live?.id).toBe('SUN-3FOR2')
    expect(campaignState(by('SUN-3FOR2'), NOW)).toBe('running')
    expect(campaignState(by('NATDAY-15'), NOW)).toBe('scheduled')
  })

  it('a live campaign the ruleset could not be read for keeps the order’s name and no window', () => {
    const [row] = composePriorityCampaigns([], ORDER, null)
    expect(row).toMatchObject({ campaign: 'SUN-3FOR2', name: says('Suncare (order)'), window: null, live: null })
  })

  it('a draft Drafts/List names twice is listed once', () => {
    expect(composePriorityCampaigns([summary('A'), summary('A')], { campaigns: [] }, null)).toHaveLength(1)
  })

  // ⚠ Held open on BO ask A: a disabled campaign with NO draft is in none of the three answers
  // (Drafts/List has no draft for it; a disable makes the next version without it, so neither
  // Order nor the live ruleset holds it). It cannot be listed until HQ adds a list door.
  it('a disabled campaign with no draft is not listed (BO ask A)', () => {
    const out = composePriorityCampaigns([], ORDER, { campaigns: [...RULESET.campaigns] })
    expect(out.map((r) => r.campaign)).not.toContain('OLD-DISABLED')
    expect(out.some((r) => r.campaignStatus === 'Disabled')).toBe(false)
  })
})

describe('featuresUsedBy_readsALiveCampaignsBlocks', () => {
  it('a points effect or check, at any depth, needs points; a coupon check coupons; plain blocks nothing', () => {
    const c = (rules: unknown[], budgets: RuleCampaign['budgets'] = []): RuleCampaign => ({ id: 'X', name: says('X'), rules, budgets }) as RuleCampaign
    expect(featuresUsedBy(c([{ when: [], then: [{ effect: 'awardPoints' }] }]), CATALOGUE)).toEqual(['points'])
    expect(featuresUsedBy(c([{ when: [{ check: 'group', conditions: [{ check: 'coupon' }] }], then: [] }]), CATALOGUE)).toEqual(['coupons'])
    expect(featuresUsedBy(c([{ when: [{ check: 'minSubtotal' }], then: [{ effect: 'discountItems' }] }]), CATALOGUE)).toEqual([])
  })

  it('a budget scoped to a coupon or limiting points needs that feature', () => {
    const budget = (scope: string, limit: string) => ({ id: 'b', name: says('b'), scope, limit, value: 1, period: 'day' }) as NonNullable<RuleCampaign['budgets']>[number]
    const c = { id: 'X', name: says('X'), rules: [], budgets: [budget('coupon', 'uses'), budget('campaign', 'pointsGiven')] } as RuleCampaign
    expect(featuresUsedBy(c, CATALOGUE)).toEqual(['coupons', 'points'])
  })
})
