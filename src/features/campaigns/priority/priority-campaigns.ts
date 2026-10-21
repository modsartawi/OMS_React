import {
  RULE_FEATURES,
  type RuleBlockCatalogue,
  type RuleCampaign,
  type RuleCampaignStatus,
  type RuleCampaignWindow,
  type RuleDraftState,
  type RuleDraftSummary,
  type RuleFeature,
  type RuleOrder,
  type RuleRuleset,
  type Says,
} from '@/core/models/rule-campaign'

// Priority's own reader of the campaigns it orders (tickets 513, 524; moved here from core by 535,
// when `Promotions/Campaigns` became the campaign area's list door, BackOffice brief 2848). Priority
// shows each campaign's state badge and feature chips, which come from the drafts and the live
// campaigns and which neither `Order.campaigns` nor `Promotions/Campaigns` answers, so it composes
// them from three of BackOffice 2759's doors. It is Priority's alone: no other screen lists campaigns
// this way. Pure: no fetch, no React; `./api` reads the doors and hands their answers here.
//
// - `Drafts/List` names every campaign that has a draft, with its `state` and `publishedVersionNo`.
// - `Order.campaigns` names every campaign the newest version runs — the live ones.
// - The live ruleset (`Versions/Load` of `Order.versionNo`) holds each live campaign whole: its
//   window says scheduled / running / expired.
//
// A draft whose campaign was published once (`publishedVersionNo > 0`) and is not in the live order
// is a DISABLED campaign's draft: a disable makes the next version without it. A disabled campaign
// with NO draft is in none of the three answers — and in no evaluation order either.

/**
 * One campaign as Priority reads it. `state` is null for a live campaign with no draft; `window` is
 * the LIVE window (null for a campaign that is not live); `features` is the draft's, null for a live
 * campaign with no draft (`live` holds its blocks); `updatedAt` / `updatedBy` are the draft's last
 * save, `''` with no draft.
 */
export interface PriorityCampaign {
  campaign: string
  name: Says
  state: RuleDraftState | null
  campaignStatus: RuleCampaignStatus
  window: RuleCampaignWindow | null
  features: RuleFeature[] | null
  /** The campaign as the live version holds it; null when it is not live. */
  live: RuleCampaign | null
  updatedAt: string
  updatedBy: string
}

/** The live campaign's status, read off the order: live, published once and gone, or never live. */
function statusOf(code: string, publishedVersionNo: number, live: ReadonlySet<string>): RuleCampaignStatus {
  if (live.has(code)) return 'Published'
  return publishedVersionNo > 0 ? 'Disabled' : ''
}

/** Every campaign the three answers know, the drafts first (last saved first), then the live
 *  campaigns with no draft in evaluation order. Each campaign is listed once. */
export function composePriorityCampaigns(
  drafts: readonly RuleDraftSummary[],
  order: Pick<RuleOrder, 'campaigns'>,
  ruleset: RuleRuleset | null,
): PriorityCampaign[] {
  const liveCodes = new Set(order.campaigns.map((c) => c.code))
  const liveJson = new Map<string, RuleCampaign>()
  for (const c of ruleset?.campaigns ?? []) if (liveCodes.has(c.id) && !liveJson.has(c.id)) liveJson.set(c.id, c)

  const rows: PriorityCampaign[] = []
  const seen = new Set<string>()
  for (const d of drafts) {
    if (seen.has(d.campaign)) continue
    seen.add(d.campaign)
    const live = liveJson.get(d.campaign) ?? null
    rows.push({
      campaign: d.campaign,
      name: d.name,
      state: d.state,
      campaignStatus: statusOf(d.campaign, d.publishedVersionNo, liveCodes),
      window: live?.window ?? null,
      features: d.features,
      live,
      updatedAt: d.updatedAt,
      updatedBy: d.updatedBy,
    })
  }
  for (const c of order.campaigns) {
    if (seen.has(c.code)) continue
    seen.add(c.code)
    const live = liveJson.get(c.code) ?? null
    rows.push({
      campaign: c.code,
      name: live?.name ?? c.name,
      state: null,
      campaignStatus: 'Published',
      window: live?.window ?? null,
      features: null,
      live,
      updatedAt: '',
      updatedBy: '',
    })
  }
  return rows
}

/** A budget's scope or limit that needs a feature (BackOffice `RuleBlockCatalogue.FeatureOf`). */
const BUDGET_FEATURE: Record<string, RuleFeature> = { coupon: 'coupons', pointsGiven: 'points', pointsTaken: 'points' }

/**
 * The features a live campaign's blocks use, read the way HQ reads them for a campaign with no
 * draft (`FeaturesUsedBy`): every `check` and `effect` anywhere in it whose catalogue block belongs
 * to a feature, and a budget scoped to a coupon or limiting points. A live campaign with no draft
 * has no features of its own, so Priority reads its points mark from this.
 */
export function featuresUsedBy(campaign: RuleCampaign, catalogue: Pick<RuleBlockCatalogue, 'conditions' | 'effects'>): RuleFeature[] {
  const types = new Set<string>()
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'check' || k === 'effect') && typeof x === 'string') types.add(x)
        else walk(x)
      }
  }
  walk(campaign.rules)
  const found = new Set<RuleFeature>()
  for (const b of [...catalogue.conditions, ...catalogue.effects]) if (b.feature && types.has(b.type)) found.add(b.feature)
  for (const b of campaign.budgets ?? []) for (const f of [BUDGET_FEATURE[b.scope], BUDGET_FEATURE[b.limit]]) if (f) found.add(f)
  return RULE_FEATURES.filter((f) => found.has(f))
}
