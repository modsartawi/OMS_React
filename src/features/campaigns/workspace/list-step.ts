import type { RulePromotionCampaignPage, RulePromotionCampaignsBody, RulePromotionOrigin } from '@/core/models/rule-promotion'
import { campaignPath } from '@/core/rules/campaign-state'
import { withListContext, type PromotionListContext } from '@/core/rules/promotion-query'

// The workspace inside its promotion's list (ticket 537; BackOffice brief 2848 "The campaign
// workspace"): Prev / Next through the list as it was filtered, in HQ's order (by id), crossing a
// page's edge by asking for the neighbouring page; a direct link's promotion through BO ask J; and
// whether a campaign is an upload's. Pure: no React, no fetch.

/**
 * One step from the campaign: a row on the same page, or the neighbouring page to ask for and the
 * row to take from it (its first going forward, its last going back).
 */
export type ListStep = { id: string; page: number } | { page: number; take: 'first' | 'last' }

export interface ListNeighbours {
  /** Null at the list's start: the step is disabled. */
  prev: ListStep | null
  /** Null at the list's end. */
  next: ListStep | null
}

/**
 * The campaign's neighbours on its list's page, or null when there is nothing to step through: no
 * context (or its page not read yet), or the campaign is not on that page (moved, or no longer
 * matching the filters).
 */
export function neighbours(id: string, page: RulePromotionCampaignPage | null | undefined): ListNeighbours | null {
  if (!page) return null
  const rows = page.campaigns
  const at = rows.findIndex((r) => r.id === id)
  if (at < 0) return null
  const prev: ListStep | null = at > 0 ? { id: rows[at - 1].id, page: page.page } : page.page > 1 ? { page: page.page - 1, take: 'last' } : null
  const next: ListStep | null =
    at < rows.length - 1 ? { id: rows[at + 1].id, page: page.page } : page.page * page.pageSize < page.total ? { page: page.page + 1, take: 'first' } : null
  return { prev, next }
}

/** The campaign a step lands on: its row, or the neighbouring page's first or last — null until that
 *  page is read, or when it came back empty (the list shrank meanwhile). */
export function neighbourId(step: ListStep, neighbourPage: RulePromotionCampaignPage | null | undefined): string | null {
  if ('id' in step) return step.id
  const rows = neighbourPage?.campaigns ?? []
  return (step.take === 'first' ? rows[0] : rows.at(-1))?.id ?? null
}

/** The neighbour's address: the same workspace page (`sub` is the path after `/campaigns/:id`), the
 *  context at the page the neighbour is on — so the way back opens that page. */
export const stepPath = (id: string, sub: string, context: PromotionListContext, page: number): string =>
  withListContext(`${campaignPath(id)}${sub}`, { ...context, query: { ...context.query, page } })

/**
 * Whether the campaign is part of an upload (brief 2848): its promotion is `origin: upload` AND its id
 * starts with `<promotionCode>-` (any case). Never `origin` alone: a hand-made promotion an upload later
 * went into keeps its hand-assigned members, which the upload does not own.
 */
export function isUploadedCampaign(
  id: string,
  promotion: { promotionCode: string | null; origin: RulePromotionOrigin | null } | null | undefined,
): boolean {
  if (!promotion?.promotionCode || promotion.origin !== 'upload') return false
  return id.toLowerCase().startsWith(`${promotion.promotionCode.toLowerCase()}-`)
}

/** HQ's largest page: `q` matches part of an id and both names, so the exact row may sit among many. */
const LOOKUP_PAGE_SIZE = 200

/** A direct link's search for its campaign among every promotion's (`Promotions/Campaigns { all }`). */
export const campaignLookupBody = (id: string): RulePromotionCampaignsBody => ({ promotionCode: null, all: true, q: id, page: 1, pageSize: LOOKUP_PAGE_SIZE })

/**
 * The promotion a direct link's campaign is in, read off the row whose id equals it exactly — or null
 * when it is not known: no such row, or a row without `promotionCode` (BO ask J, BackOffice 2855, not
 * built yet). `{ promotionCode: null }` is known: the campaign is in no promotion.
 */
export function promotionOfLookup(page: RulePromotionCampaignPage | null | undefined, id: string): { promotionCode: string | null } | null {
  const row = page?.campaigns.find((r) => r.id === id)
  if (!row || row.promotionCode === undefined) return null
  return { promotionCode: row.promotionCode }
}
