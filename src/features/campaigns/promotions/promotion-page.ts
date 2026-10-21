import type { RuleDraftSummary } from '@/core/models/rule-campaign'
import type { RulePromotionCampaignRow, RulePromotionCampaignStatus } from '@/core/models/rule-promotion'
import { PROMOTION_CAMPAIGN_STATUSES } from '@/core/rules/promotion-query'
import { windowDays } from '@/core/rules/wire-days'
import type { Severity } from '@/core/ui/severity'

/**
 * What a promotion's page makes of a `Promotions/Campaigns` page (ticket 535; BackOffice brief 2848
 * D2): pure, no React, no i18n — the page renders these through its own keys.
 */

/** A mechanic chip: `''` is "All". */
export interface MechanicChip {
  mechanic: string
  count: number
}

/**
 * The mechanic chips: "All" with the sum, then EVERY key of `mechanics` with its count, in the order
 * HQ sent them — `builder` and a mechanic this client has no word for included. The counts follow
 * `q` and `status` but not `mechanic` (HQ's reading), so every chip keeps its count when one is on.
 * The mechanic `on` in the URL stays a chip, at 0, when the search or status left none of it (HQ
 * then counts no key for it), so it can still be seen and cleared.
 */
export function mechanicChips(mechanics: { [mechanic: string]: number }, on = ''): MechanicChip[] {
  const chips = Object.entries(mechanics).map(([mechanic, count]) => ({ mechanic, count }))
  const all = { mechanic: '', count: chips.reduce((sum, c) => sum + c.count, 0) }
  return on && !Object.hasOwn(mechanics, on) ? [all, ...chips, { mechanic: on, count: 0 }] : [all, ...chips]
}

/**
 * The drafts never published (`publishedVersionNo` 0, as Priority's composition reads it): in no
 * promotion until they are published, so in no `Promotions/Campaigns` page. The no-promotion page
 * lists them above its table, as `Drafts/List` sent them (last saved first).
 */
export const neverPublishedDrafts = (drafts: readonly RuleDraftSummary[]): RuleDraftSummary[] => drafts.filter((d) => d.publishedVersionNo === 0)

/**
 * The campaigns a pending re-upload adds: `campaignCount` leaves them out until activated, but the
 * unfiltered `total` counts them as `Pending` rows. 0 when the total is not the larger.
 */
export const pendingBeyond = (campaignCount: number, unfilteredTotal: number): number => Math.max(0, unfilteredTotal - campaignCount)

/** The statuses this client has words for (the status filter's); an unknown one renders as `Disabled`. */
export type CampaignRowStatus = (typeof PROMOTION_CAMPAIGN_STATUSES)[number]

/** Published runs; a pending upload's campaign waits for a human; a disabled one is out. */
export const CAMPAIGN_ROW_STATUS_SEV: Record<CampaignRowStatus, Severity> = { Published: 'ok', Pending: 'warn', Disabled: 'mute' }

export const campaignRowStatus = (status: RulePromotionCampaignStatus): CampaignRowStatus =>
  (PROMOTION_CAMPAIGN_STATUSES as readonly string[]).includes(status) ? (status as CampaignRowStatus) : 'Disabled'

export interface CampaignRowView {
  id: string
  nameEn: string
  nameAr: string
  nameArGenerated: boolean
  /** `''` for a campaign uploaded before 2846 (HQ sends null). */
  mechanic: string
  skuCount: number
  ruleCount: number
  /** The inclusive days as ONE range (isolate it once), or null without a window. */
  window: string | null
  status: CampaignRowStatus
}

export function campaignRowView(r: RulePromotionCampaignRow): CampaignRowView {
  return {
    id: r.id,
    nameEn: (r.nameEn ?? '').trim(),
    nameAr: (r.nameAr ?? '').trim(),
    nameArGenerated: r.nameArGenerated === true,
    mechanic: r.mechanic ?? '',
    skuCount: r.skuCount,
    ruleCount: r.ruleCount,
    window: windowDays(r.windowFrom, r.windowUntil),
    status: campaignRowStatus(r.status),
  }
}
